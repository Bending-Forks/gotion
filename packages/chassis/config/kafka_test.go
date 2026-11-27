package config_test

import (
	"slices"
	"testing"

	"github.com/Bending-Forks/gotion/packages/chassis/config"
)

func TestKafkaBrokers(t *testing.T) {
	t.Run("one broker", func(t *testing.T) {
		t.Setenv("KAFKA_BROKERS", "kafka:9092")
		brokers, err := config.KafkaBrokers()
		if err != nil || !slices.Equal(brokers, []string{"kafka:9092"}) {
			t.Fatalf("KafkaBrokers = %q, %v", brokers, err)
		}
	})
	t.Run("brokers separated by commas", func(t *testing.T) {
		t.Setenv("KAFKA_BROKERS", "kafka-0:9092,kafka-1:9092")
		brokers, err := config.KafkaBrokers()
		if err != nil || !slices.Equal(brokers, []string{"kafka-0:9092", "kafka-1:9092"}) {
			t.Fatalf("KafkaBrokers = %q, %v", brokers, err)
		}
	})
	t.Run("missing brokers", func(t *testing.T) {
		t.Setenv("KAFKA_BROKERS", "")
		if _, err := config.KafkaBrokers(); err == nil {
			t.Fatal("KafkaBrokers without KAFKA_BROKERS succeeded")
		}
	})
}
