Add-Type -AssemblyName System.Drawing

function ExtractCleanGlow($sourceBmp, $rect, $darkR, $darkG, $darkB) {
    $out = New-Object System.Drawing.Bitmap($rect.Width, $rect.Height, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    for ($x = 0; $x -lt $rect.Width; $x++) {
        for ($y = 0; $y -lt $rect.Height; $y++) {
            $srcC = $sourceBmp.GetPixel($rect.X + $x, $rect.Y + $y)
            $r = [Math]::Max(0, [int]$srcC.R - $darkR)
            $g = [Math]::Max(0, [int]$srcC.G - $darkG)
            $b = [Math]::Max(0, [int]$srcC.B - $darkB)
            $maxVal = [Math]::Max($r, [Math]::Max($g, $b))
            
            if ($maxVal -le 4) {
                $out.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(0, 0, 0, 0))
            } else {
                $alpha = [Math]::Min(255, [int]($maxVal * 2.0))
                $normR = [Math]::Min(255, [int](($srcC.R / [Math]::Max(1, $alpha / 255.0))))
                $normG = [Math]::Min(255, [int](($srcC.G / [Math]::Max(1, $alpha / 255.0))))
                $normB = [Math]::Min(255, [int](($srcC.B / [Math]::Max(1, $alpha / 255.0))))
                $out.SetPixel($x, $y, [System.Drawing.Color]::FromArgb($alpha, $normR, $normG, $normB))
            }
        }
    }
    return $out
}

$bmp = [System.Drawing.Bitmap]::FromFile('d:\Capychat\login\exemplo.png')

# 1. Top-left dice: X: 410 to 570, Y: 95 to 255
$c1 = ExtractCleanGlow $bmp (New-Object System.Drawing.Rectangle(410, 95, 160, 160)) 15 15 40
$c1.Save('d:\LYC-Arena\public\assets\login\dado-topo-esq.png', [System.Drawing.Imaging.ImageFormat]::Png)
$c1.Dispose()

# 2. Bottom-left floor dice: X: 45 to 240, Y: 740 to 910
$c2 = ExtractCleanGlow $bmp (New-Object System.Drawing.Rectangle(45, 740, 195, 170)) 15 15 45
$c2.Save('d:\LYC-Arena\public\assets\login\dado-chao.png', [System.Drawing.Imaging.ImageFormat]::Png)
$c2.Dispose()

# 3. Top-right dice: X: 1470 to 1660, Y: 75 to 265
$c3 = ExtractCleanGlow $bmp (New-Object System.Drawing.Rectangle(1470, 75, 190, 190)) 15 15 40
$c3.Save('d:\LYC-Arena\public\assets\login\dado-topo-dir.png', [System.Drawing.Imaging.ImageFormat]::Png)
$c3.Dispose()

# 4. Bottom-right dice: X: 1420 to 1672, Y: 640 to 941
$c4 = ExtractCleanGlow $bmp (New-Object System.Drawing.Rectangle(1420, 640, 252, 301)) 15 15 45
$c4.Save('d:\LYC-Arena\public\assets\login\dado-base-dir.png', [System.Drawing.Imaging.ImageFormat]::Png)
$c4.Dispose()

$bmp.Dispose()
Write-Output "Extracted all 4 crystals perfectly!"
