Get-Process electron -ErrorAction SilentlyContinue | ForEach-Object {
    Write-Host "Id: $($_.Id) | Handle: $($_.MainWindowHandle) | Title: $($_.MainWindowTitle) | Responding: $($_.Responding)"
}
