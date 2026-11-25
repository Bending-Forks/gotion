package queryclient

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/sony/gobreaker/v2"
)

// Client sends the queries of one service to another. It is the HttpRequestDoer of the client that oapi-codegen generates from the OpenAPI specification of the callee: pass it with WithHTTPClient.
type Client struct {
	http    *http.Client
	timeout time.Duration
	breaker *gobreaker.CircuitBreaker[*http.Response]
}

// New returns a Client whose calls each take at most timeout, retry included, behind a circuit breaker with the given settings; a zero field keeps the default of gobreaker.
func New(timeout time.Duration, breaker gobreaker.Settings) *Client {
	return &Client{http: &http.Client{}, timeout: timeout, breaker: gobreaker.NewCircuitBreaker[*http.Response](breaker)}
}

// Do sends req and returns the answer of the callee, a 4xx included. Any error means the callee did not answer: the call failed, timed out, got a 5xx twice or found the circuit open, and the adapter refuses the command (fail closed).
func (c *Client) Do(req *http.Request) (*http.Response, error) {
	ctx, cancel := context.WithTimeout(req.Context(), c.timeout)
	defer cancel()
	resp, err := c.breaker.Execute(func() (*http.Response, error) {
		resp, err := c.send(ctx, req)
		// The queries only read, so one retry is safe; a body that cannot be read again is not resent.
		if err != nil && ctx.Err() == nil && (req.Body == nil || req.GetBody != nil) {
			resp, err = c.send(ctx, req)
		}
		return resp, err
	})
	if err != nil {
		return nil, fmt.Errorf("query %s: %w", c.breaker.Name(), err)
	}
	return resp, nil
}

// send makes one attempt. It reads the whole body, so that the timeout covers it and the cancel of Do does not cut it.
func (c *Client) send(ctx context.Context, req *http.Request) (*http.Response, error) {
	attempt := req.Clone(ctx)
	if req.GetBody != nil {
		body, err := req.GetBody()
		if err != nil {
			return nil, err
		}
		attempt.Body = body
	}
	resp, err := c.http.Do(attempt)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	if resp.StatusCode >= http.StatusInternalServerError {
		return nil, fmt.Errorf("%s %s answered %s", req.Method, req.URL, resp.Status)
	}
	resp.Body = io.NopCloser(bytes.NewReader(body))
	return resp, nil
}
