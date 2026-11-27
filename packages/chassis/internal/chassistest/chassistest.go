// Package chassistest gives the integration tests of the chassis their own Kafka topics and PostgreSQL databases, created on the servers that TEST_KAFKA_BROKERS and TEST_DATABASE_URL name and removed at the end of each test.
package chassistest

import (
	"context"
	"errors"
	"fmt"
	"net/url"
	"os"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/IBM/sarama"
	"github.com/jackc/pgx/v5"
)

// Brokers returns the Kafka brokers in TEST_KAFKA_BROKERS, comma separated, and skips the test without them.
func Brokers(t *testing.T) []string {
	t.Helper()
	brokers := os.Getenv("TEST_KAFKA_BROKERS")
	if brokers == "" {
		t.Skip("TEST_KAFKA_BROKERS is not set")
	}
	return strings.Split(brokers, ",")
}

// Topic creates a topic with three partitions, as compose.yaml does, and deletes it at the end of the test.
func Topic(t *testing.T, brokers []string) string {
	t.Helper()
	admin, err := sarama.NewClusterAdmin(brokers, sarama.NewConfig())
	if err != nil {
		t.Fatal(err)
	}
	name := fmt.Sprintf("chassis-test-%d", time.Now().UnixNano())
	if err := admin.CreateTopic(name, &sarama.TopicDetail{NumPartitions: 3, ReplicationFactor: 1}, false); err != nil {
		t.Fatal(err)
	}
	// A new topic has no leader for a moment, and reading or writing it would fail.
	client, err := sarama.NewClient(brokers, sarama.NewConfig())
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = client.Close() }()
	Eventually(t, 30*time.Second, "every partition of "+name+" has a leader", func() bool {
		if err := client.RefreshMetadata(name); err != nil {
			return false
		}
		for p := range int32(3) {
			if _, err := client.Leader(name, p); err != nil {
				return false
			}
		}
		return true
	})
	t.Cleanup(func() {
		// A retried request can find the topic already deleted by the first one.
		if err := admin.DeleteTopic(name); err != nil && !errors.Is(err, sarama.ErrUnknownTopicOrPartition) {
			t.Error(err)
		}
		_ = admin.Close()
	})
	return name
}

// Produce sends value to topic with key and no header, as the producer of Editing does, and waits for Kafka's acknowledgement.
func Produce(t *testing.T, brokers []string, topic, key string, value []byte) {
	t.Helper()
	config := sarama.NewConfig()
	config.Producer.Return.Successes = true
	producer, err := sarama.NewSyncProducer(brokers, config)
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = producer.Close() }()
	if _, _, err := producer.SendMessage(&sarama.ProducerMessage{Topic: topic, Key: sarama.StringEncoder(key), Value: sarama.ByteEncoder(value)}); err != nil {
		t.Fatal(err)
	}
}

// Committed returns the highest offset that group committed on the partitions of topic, -1 when it committed none.
func Committed(t *testing.T, brokers []string, group, topic string) int64 {
	t.Helper()
	admin, err := sarama.NewClusterAdmin(brokers, sarama.NewConfig())
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = admin.Close() }()
	partitions := []int32{0, 1, 2}
	offsets, err := admin.ListConsumerGroupOffsets(group, map[string][]int32{topic: partitions})
	if err != nil {
		t.Fatal(err)
	}
	highest := int64(-1)
	for _, p := range partitions {
		if b := offsets.GetBlock(topic, p); b != nil {
			highest = max(highest, b.Offset)
		}
	}
	return highest
}

// ForgetOffsets deletes the offsets that group committed on topic, as if it had never committed them; the group must have stopped.
func ForgetOffsets(t *testing.T, brokers []string, group, topic string) {
	t.Helper()
	config := sarama.NewConfig()
	// Deleting the offsets of a group needs the protocol of Kafka 2.4 or later.
	config.Version = sarama.V2_4_0_0
	admin, err := sarama.NewClusterAdmin(brokers, config)
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = admin.Close() }()
	partitions := []int32{0, 1, 2}
	// The broker refuses while the group still has members, until it notices they left.
	Eventually(t, 30*time.Second, "the offsets of "+group+" are deleted", func() bool {
		for _, p := range partitions {
			if err := admin.DeleteConsumerGroupOffset(group, topic, p); err != nil && !errors.Is(err, sarama.ErrUnknownTopicOrPartition) {
				return false
			}
		}
		return true
	})
	offsets, err := admin.ListConsumerGroupOffsets(group, map[string][]int32{topic: partitions})
	if err != nil {
		t.Fatal(err)
	}
	for _, p := range partitions {
		if b := offsets.GetBlock(topic, p); b != nil && b.Offset != -1 {
			t.Fatalf("group %s still has offset %d on partition %d", group, b.Offset, p)
		}
	}
}

// Eventually polls check until it returns true, and fails the test after timeout.
func Eventually(t *testing.T, timeout time.Duration, what string, check func() bool) {
	t.Helper()
	deadline := time.Now().Add(timeout)
	for !check() {
		if time.Now().After(deadline) {
			t.Fatalf("%s: not within %s", what, timeout)
		}
		time.Sleep(50 * time.Millisecond)
	}
}

// Record is a message read from Kafka, with its key and partition.
type Record struct {
	Key       string
	Value     []byte
	Partition int32
}

// Read reads every partition of topic from the oldest offset until done returns true for the records read so far, and fails the test after timeout.
func Read(t *testing.T, brokers []string, topic string, timeout time.Duration, done func([]Record) bool) []Record {
	t.Helper()
	consumer, err := sarama.NewConsumer(brokers, sarama.NewConfig())
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = consumer.Close() }()
	partitions, err := consumer.Partitions(topic)
	if err != nil {
		t.Fatal(err)
	}
	records, stop := make(chan Record), make(chan struct{})
	var readers sync.WaitGroup
	var opened []sarama.PartitionConsumer
	defer func() {
		// The readers stop forwarding, then end when their partition closes.
		close(stop)
		for _, pc := range opened {
			_ = pc.Close()
		}
		readers.Wait()
	}()
	for _, p := range partitions {
		pc, err := consumer.ConsumePartition(topic, p, sarama.OffsetOldest)
		if err != nil {
			t.Fatal(err)
		}
		opened = append(opened, pc)
		readers.Go(func() {
			for m := range pc.Messages() {
				select {
				case records <- Record{Key: string(m.Key), Value: m.Value, Partition: m.Partition}:
				case <-stop:
				}
			}
		})
	}
	var read []Record
	deadline := time.After(timeout)
	for !done(read) {
		select {
		case r := <-records:
			read = append(read, r)
		case <-deadline:
			t.Fatalf("read %d records from %s before the deadline, not the ones expected", len(read), topic)
		}
	}
	return read
}

// Database creates a database on the server in TEST_DATABASE_URL, runs schema in it and drops it at the end of the test; it skips the test without a server.
func Database(t *testing.T, schema string) string {
	t.Helper()
	server := os.Getenv("TEST_DATABASE_URL")
	if server == "" {
		t.Skip("TEST_DATABASE_URL is not set")
	}
	ctx := t.Context()
	admin, err := pgx.Connect(ctx, server)
	if err != nil {
		t.Fatal(err)
	}
	name := fmt.Sprintf("chassis_test_%d", time.Now().UnixNano())
	if _, err := admin.Exec(ctx, "CREATE DATABASE "+name); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		// t.Context() is cancelled before the cleanup runs.
		ctx := context.WithoutCancel(ctx)
		if _, err := admin.Exec(ctx, "DROP DATABASE "+name+" WITH (FORCE)"); err != nil {
			t.Error(err)
		}
		_ = admin.Close(ctx)
	})
	u, err := url.Parse(server)
	if err != nil {
		t.Fatal(err)
	}
	u.Path = "/" + name
	conn, err := pgx.Connect(ctx, u.String())
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = conn.Close(ctx) }()
	if _, err := conn.Exec(ctx, schema); err != nil {
		t.Fatal(err)
	}
	return u.String()
}
