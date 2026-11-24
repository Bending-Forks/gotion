package main

import (
	"encoding/json"
	"io/fs"
	"os"
	"path/filepath"
	"regexp"
	"slices"
	"strings"
	"testing"
)

// ADR-03: Discussion asks Membership through its query and consumes none of its events. The types of an event are generated in the consumer, so no import gives it away: the check looks for the names of the events of Membership in the Go code of Discussion instead.
func TestDiscussionConsumesNoEventOfMembership(t *testing.T) {
	t.Parallel()
	names := membershipEventNames(t)

	t.Run("finds an event of Membership in its violations", func(t *testing.T) {
		t.Parallel()
		dir := filepath.Join("testdata", "membership-events")
		found, err := goFilesNaming(dir, names)
		if err != nil {
			t.Fatal(err)
		}
		want := []string{filepath.Join(dir, "generate.go"), filepath.Join(dir, "handler.go")}
		if !slices.Equal(found, want) {
			t.Errorf("found %v, want %v", found, want)
		}
	})

	t.Run("Discussion names no event of Membership", func(t *testing.T) {
		t.Parallel()
		found, err := goFilesNaming(".", names)
		if err != nil {
			t.Fatal(err)
		}
		if len(found) > 0 {
			t.Errorf("ADR-03: Discussion consumes no event of Membership, but %v name one of %v", found, names)
		}
	})
}

// membershipEventNames returns what code that consumes an event of Membership names: the file of its schema, from which its types are generated, and its type, as in the envelope and in the title of the schema.
func membershipEventNames(t *testing.T) []string {
	t.Helper()
	dir := filepath.Join("..", "membership", "api", "events")
	files, err := filepath.Glob(filepath.Join(dir, "*.json"))
	if err != nil {
		t.Fatal(err)
	}
	if len(files) == 0 {
		t.Fatalf("no event schema in %s: the check would look for nothing", dir)
	}
	version := regexp.MustCompile(`V[0-9]+$`)
	var names []string
	for _, file := range files {
		data, err := os.ReadFile(file)
		if err != nil {
			t.Fatal(err)
		}
		var schema struct {
			Title string `json:"title"`
		}
		if err := json.Unmarshal(data, &schema); err != nil {
			t.Fatalf("read %s: %v", file, err)
		}
		if schema.Title == "" {
			t.Fatalf("%s has no title", file)
		}
		stem, _, _ := strings.Cut(filepath.Base(file), ".")
		names = append(names, stem, version.ReplaceAllString(schema.Title, ""))
	}
	return names
}

// goFilesNaming returns the Go files under root, tests and testdata left out, that contain one of names.
func goFilesNaming(root string, names []string) ([]string, error) {
	var found []string
	err := filepath.WalkDir(root, func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if d.IsDir() {
			if d.Name() == "testdata" && path != root {
				return filepath.SkipDir
			}
			return nil
		}
		if filepath.Ext(path) != ".go" || strings.HasSuffix(path, "_test.go") {
			return nil
		}
		data, err := os.ReadFile(path)
		if err != nil {
			return err
		}
		if slices.ContainsFunc(names, func(name string) bool { return strings.Contains(string(data), name) }) {
			found = append(found, path)
		}
		return nil
	})
	return found, err
}
