#!/usr/bin/env sh
# Run the sandbox tests from any directory.
cd "$(dirname "$0")" && python3 -m unittest discover -s tests -t . "$@"
