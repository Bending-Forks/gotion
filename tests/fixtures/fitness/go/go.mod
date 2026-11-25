// The violations of the depguard rules of .golangci.yml, at the paths they would have in the repository. Outside go.work, so only the step of the CI that expects them to fail lints them.
module github.com/Bending-Forks/gotion/tests/fixtures/fitness/go

go 1.25.0

require github.com/Bending-Forks/gotion/packages/chassis v0.0.0

replace github.com/Bending-Forks/gotion/packages/chassis => ../../../../packages/chassis
