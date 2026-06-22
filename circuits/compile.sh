#!/bin/bash
# Compile Noir effort_threshold circuit and copy to public directory
# Requires: nargo installed (https://noir-lang.org/docs/getting_started/installation/)
#
# Usage: ./circuits/compile.sh

set -e

CIRCUIT_DIR="circuits/effort_threshold"
PUBLIC_DIR="public/circuits/effort_threshold/target"

echo "Compiling Noir circuit: effort_threshold..."
cd "$CIRCUIT_DIR"
nargo compile

echo "Copying compiled circuit to public directory..."
mkdir -p "../../$PUBLIC_DIR"
cp -r target/* "../../$PUBLIC_DIR/"

echo "Done. Circuit available at /circuits/effort_threshold/target/effort_threshold.json"
