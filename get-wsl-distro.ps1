$keys = Get-ChildItem 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Lxss' -ErrorAction SilentlyContinue
foreach ($key in $keys) {
    $props = Get-ItemProperty -LiteralPath $key.PSPath -ErrorAction SilentlyContinue
    if ($props.DistributionName) {
        Write-Output $props.DistributionName
    }
}
