Add-Type -AssemblyName System.Drawing

function Resize-Image {
    param(
        [string]$sourcePath,
        [string]$destPath,
        [int]$width,
        [int]$height,
        [bool]$pad = $false
    )
    $resolved = (Resolve-Path $sourcePath).Path
    $src = [System.Drawing.Image]::FromFile($resolved)
    $bmp = New-Object System.Drawing.Bitmap($width, $height, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $graphics = [System.Drawing.Graphics]::FromImage($bmp)
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $graphics.Clear([System.Drawing.Color]::Transparent)

    if ($pad) {
        $padW = [int]($width * 0.8)
        $padH = [int]($height * 0.8)
        $offsetX = [int](($width - $padW) / 2)
        $offsetY = [int](($height - $padH) / 2)
        $graphics.DrawImage($src, $offsetX, $offsetY, $padW, $padH)
    } else {
        $graphics.DrawImage($src, 0, 0, $width, $height)
    }

    $graphics.Dispose()
    $bmp.Save($destPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
    $src.Dispose()
    Write-Host ("Created " + $destPath + " (" + $width + "x" + $height + ")")
}

Resize-Image "public/icon.png" "public/icon-192.png" 192 192 $false
Resize-Image "public/icon.png" "public/icon-512.png" 512 512 $false
Resize-Image "public/icon.png" "public/apple-touch-icon.png" 180 180 $false
Resize-Image "public/icon.png" "public/icon-maskable-192.png" 192 192 $true
Resize-Image "public/icon.png" "public/icon-maskable-512.png" 512 512 $true
