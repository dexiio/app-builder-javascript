#!/usr/bin/env bash

DIR=$(dirname "$0")

SOURCEDIR="$1"
TARGET="$DIR/target"

if [[ "$2" == "" ]]; then
    TARGET="$2"
fi

docker run --rm -v $SOURCEDIR:/var/workspace/source:ro -v $TARGET:/var/workspace/target:rw dexi/app-builder-javascript