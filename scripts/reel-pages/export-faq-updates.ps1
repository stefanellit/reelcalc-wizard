param([Parameter(Mandatory=$true)][string]$ReportDirectory)
$ErrorActionPreference = 'Stop'
$rows = @(Get-Content -Raw -LiteralPath (Join-Path $ReportDirectory 'squarespace-updated-products.json') | ConvertFrom-Json)
$pilot = @($rows | Where-Object { $_.'Product URL' -eq 'penn-battle-iv-5000' })
$remaining = @($rows | Where-Object { $_.'Product URL' -ne 'penn-battle-iv-5000' })
if ($pilot.Count -ne 1) { throw 'Expected exactly one pilot product.' }
$batches = @(
    @{ Name='UPDATE-BRAID-FAQ-PILOT.csv'; Rows=$pilot },
    @{ Name='UPDATE-BRAID-FAQ-REMAINING.csv'; Rows=$remaining },
    @{ Name='UPDATE-BRAID-FAQ-ALL.csv'; Rows=$rows }
)
foreach ($batch in $batches) {
    $file = Join-Path $ReportDirectory $batch.Name
    $batch.Rows | Export-Csv -LiteralPath $file -NoTypeInformation -Encoding utf8
    $restored = @(Import-Csv -LiteralPath $file)
    if ($restored.Count -ne $batch.Rows.Count) { throw "Row count changed: $file" }
    for ($i=0; $i -lt $restored.Count; $i++) {
        foreach ($property in $batch.Rows[$i].PSObject.Properties) {
            if ($restored[$i].PSObject.Properties[$property.Name].Value -cne $property.Value) {
                throw "CSV round trip changed row $i field $($property.Name)."
            }
        }
    }
    [pscustomobject]@{File=$file;Rows=$restored.Count;Bytes=(Get-Item -LiteralPath $file).Length;RoundTripPassed=$true}
}
