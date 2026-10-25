Add-Type -AssemblyName System.Drawing

function ExtractCleanGlow($sourceBmp, $rect, $darkR, $darkG, $darkB) {
    $out = New-Object System.Drawing.Bitmap($rect.Width, $rect.Height, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    for ($x = 0; $x -lt $rect.Width; $x++) {
        for ($y = 0; $y -lt $rect.Height; $y++) {
            $srcC = $sourceBmp.GetPixel($rect.X + $x, $rect.Y + $y)
            # Subtract dark background color
            $r = [Math]::Max(0, [int]$srcC.R - $darkR)
            $g = [Math]::Max(0, [int]$srcC.G - $darkG)
            $b = [Math]::Max(0, [int]$srcC.B - $darkB)
            $maxVal = [Math]::Max($r, [Math]::Max($g, $b))
            
            if ($maxVal -le 5) {
                $out.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(0, 0, 0, 0))
            } else {
                $alpha = [Math]::Min(255, [int]($maxVal * 1.8))
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

# 1. Cristal Topo Esquerdo: x: 230, y: 90, w: 140, h: 160
$c1 = ExtractCleanGlow $bmp (New-Object System.Drawing.Rectangle(230, 90, 140, 160)) 15 15 35
$c1.Save('d:\LYC-Arena\public\assets\login\dado-topo-esq.png', [System.Drawing.Imaging.ImageFormat]::Png)
$c1.Dispose()

# 2. Cristal Base Esquerda (Floor): x: 45, y: 740, w: 190, h: 170
$c2 = ExtractCleanGlow $bmp (New-Object System.Drawing.Rectangle(45, 740, 190, 170)) 20 15 45
$c2.Save('d:\LYC-Arena\public\assets\login\dado-chao.png', [System.Drawing.Imaging.ImageFormat]::Png)
$c2.Dispose()

# 3. Cristal Topo Direito: x: 1430, y: 70, w: 180, h: 180
$c3 = ExtractCleanGlow $bmp (New-Object System.Drawing.Rectangle(1430, 70, 180, 180)) 15 15 40
$c3.Save('d:\LYC-Arena\public\assets\login\dado-topo-dir.png', [System.Drawing.Imaging.ImageFormat]::Png)
$c3.Dispose()

# 4. Cristal Base Direita: x: 1390, y: 640, w: 280, h: 290
$c4 = ExtractCleanGlow $bmp (New-Object System.Drawing.Rectangle(1390, 640, 280, 290)) 20 15 45
$c4.Save('d:\LYC-Arena\public\assets\login\dado-base-dir.png', [System.Drawing.Imaging.ImageFormat]::Png)
$c4.Dispose()

$bmp.Dispose()
Write-Output "All 4 dice crystals extracted perfectly!"
