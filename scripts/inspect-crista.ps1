Add-Type -AssemblyName System.Drawing
$bmp = [System.Drawing.Bitmap]::FromFile('d:\Capychat\login\crista.png')

# Let's find all distinct non-transparent regions in crista.png
Write-Output "Scanning crista.png non-transparent pixels..."
$nonTrans = 0
for ($x = 0; $x -lt $bmp.Width; $x += 10) {
    for ($y = 0; $y -lt $bmp.Height; $y += 10) {
        $c = $bmp.GetPixel($x, $y)
        if ($c.A -gt 20) {
            $nonTrans++
        }
    }
}
Write-Output "Found $nonTrans non-transparent samples in crista.png"

$bmp.Dispose()
