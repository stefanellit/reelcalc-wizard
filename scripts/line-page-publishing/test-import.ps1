$ErrorActionPreference = 'Stop'
$root = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$file = Join-Path $root 'generated/line-pages/UPLOAD-THIS-three-line-guides.csv'
$rows = @(Import-Csv -LiteralPath $file)
$registry = Get-Content -LiteralPath (Join-Path $root 'data/line-page-imports.json') -Raw | ConvertFrom-Json
function Assert-Import($condition, $message) { if (-not $condition) { throw $message } }
Assert-Import ($rows.Count -eq 3) 'Expected exactly three import rows.'
Assert-Import (@($rows | Select-Object -ExpandProperty SKU -Unique).Count -eq 3) 'Duplicate SKU.'
Assert-Import (@($rows | Select-Object -ExpandProperty 'Product URL' -Unique).Count -eq 3) 'Duplicate URL.'
foreach ($row in $rows) {
    $slug = $row.'Product URL'
    $entry = $registry.pages.$slug
    Assert-Import ($null -ne $entry) "Missing registry entry: $slug"
    Assert-Import ($row.'Product ID [Non Editable]' -eq '' -and $row.'Variant ID [Non Editable]' -eq '') 'Create-only IDs must be blank.'
    Assert-Import ($row.'Product Type [Non Editable]' -eq 'SERVICE') 'Wrong product type.'
    Assert-Import ($row.'Product Page' -eq 'lines' -and $row.Categories -eq '/line-guides') 'Wrong collection/category.'
    Assert-Import ($row.Visible -eq 'No') 'Initial import must be hidden.'
    Assert-Import ($row.Tags -eq 'reelcalc-line-guide') 'Missing guide tag.'
    Assert-Import ($row.Title -eq $entry.title -and $row.SKU -eq $entry.sku) 'Registry identity mismatch.'
    Assert-Import ($entry.url -eq "https://www.reelcalc.com/lines/p/$slug") 'Wrong final URL.'
    Assert-Import ($row.Title.Length -le 200 -and $slug -match '^[a-z0-9-]{3,200}$') 'Invalid title or URL.'
    Assert-Import ($row.Description -notmatch '<(script|iframe|input|select|button|style)\b') 'Unsupported executable or interactive import HTML.'
    Assert-Import ($row.Description -match '<table' -and $row.Description -match 'Specifications &amp; sources') 'Missing static chart/sources.'
    Assert-Import ($row.Description -notmatch '127\.0\.0\.1|localhost|Loading .+\.\.\.') 'Local link or placeholder leaked into import.'
    $preview = Get-Content -LiteralPath (Join-Path $root "previews/line-pages/$($entry.id)-imported.html") -Raw
    Assert-Import ($preview.Contains($row.Description)) 'CSV quoting altered HTML compared with the tested wrapper.'
    Assert-Import ($row.'Option Name 1' -eq '' -and $row.'Hosted Image URLs' -eq '') 'Unexpected variants/gallery import.'
}
Write-Output 'PASS: 3 hidden service guides, independent CSV parser round-trip, valid identity/URLs, complete static fallback HTML.'
