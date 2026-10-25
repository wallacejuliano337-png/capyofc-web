Add-Type -AssemblyName System.Drawing
$bmp = [System.Drawing.Bitmap]::FromFile('d:\LYC-Arena\public\assets\login\capychat.png')

$minX = 9999; $maxX = 0; $minY = 9999; $maxY = 0
for ($x = 0; $x -lt $bmp.Width; $x++) {
    for ($y = 0; $y -lt $bmp.Height; $y++) {
        if ($bmp.GetPixel($x, $y).A -gt 15) {
            if ($x -lt $minX) { $minX = $x }
            if ($x -gt $maxX) { $maxX = $x }
            if ($y -lt $minY) { $minY = $y }
            if ($y -gt $maxY) { $maxY = $y }
        }
    }
}
Write-Output "Tight logo bounds in capychat.png: X=[$minX, $maxX], Y=[$minY, $maxY]"
$w = $maxX - $minX + 1
$h = $maxY - $minY + 1
Write-Output "Size: $w x $h"

$rect = New-Object System.Drawing.Rectangle($minX, $minY, $w, $h)
$cropped = $bmp.Clone($rect, $bmp.PixelFormat)
$outPath = 'd:\LYC-Arena\public\assets\login\capychat-tight.png'
$cropped.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
$cropped.Dispose()
$bmp.Dispose()
Write-Output "Saved tight logo to $outPath"
