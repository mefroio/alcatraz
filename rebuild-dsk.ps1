$ErrorActionPreference = "Stop"
$script = Join-Path $PSScriptRoot "tools/rebuild_dsk.py"
python $script @args
