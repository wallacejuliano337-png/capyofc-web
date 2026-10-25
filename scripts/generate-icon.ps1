Add-Type -AssemblyName System.Drawing

$srcPng = "assets/icon.png"
if (!(Test-Path $srcPng)) {
    $srcPng = "public/icon.png"
}
$orig = [System.Drawing.Bitmap]::FromFile((Resolve-Path $srcPng).Path)

# Standard sizes for Windows ICO
$sizes = @(16, 24, 32, 48, 64, 128, 256)

# Create multi-size ICO structure using binary writer
$ms = New-Object System.IO.MemoryStream
$bw = New-Object System.IO.BinaryWriter($ms)

# ICO Header: Reserved (2 bytes), Type (2 bytes: 1=icon), Count (2 bytes)
$bw.Write([uint16]0)
$bw.Write([uint16]1)
$bw.Write([uint16]$sizes.Count)

$imageDataList = @()
$offset = 6 + ($sizes.Count * 16)

foreach ($sz in $sizes) {
    $bmp = New-Object System.Drawing.Bitmap($sz, $sz, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.DrawImage($orig, 0, 0, $sz, $sz)
    $g.Dispose()

    $imgStream = New-Object System.IO.MemoryStream
    $bmp.Save($imgStream, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
    $bytes = $imgStream.ToArray()
    $imgStream.Dispose()

    # Directory entry:
    # Width (1 byte, 0 = 256)
    $wByte = if ($sz -eq 256) { [byte]0 } else { [byte]$sz }
    $bw.Write($wByte)
    # Height (1 byte, 0 = 256)
    $hByte = if ($sz -eq 256) { [byte]0 } else { [byte]$sz }
    $bw.Write($hByte)
    # ColorCount (1 byte)
    $bw.Write([byte]0)
    # Reserved (1 byte)
    $bw.Write([byte]0)
    # Planes (2 bytes)
    $bw.Write([uint16]1)
    # BitCount (2 bytes)
    $bw.Write([uint16]32)
    # BytesInRes (4 bytes)
    $bw.Write([uint32]$bytes.Length)
    # ImageOffset (4 bytes)
    $bw.Write([uint32]$offset)

    $offset += $bytes.Length
    $imageDataList += ,$bytes
}

foreach ($imgBytes in $imageDataList) {
    $bw.Write($imgBytes)
}

$orig.Dispose()

# Backup old icon.ico
if (Test-Path "assets/icon.ico") {
    Copy-Item -Path "assets/icon.ico" -Destination "assets/icon.ico.bak" -Force
}

$fileStream = [System.IO.File]::Create("assets/icon.ico")
$icoBytes = $ms.ToArray()
$fileStream.Write($icoBytes, 0, $icoBytes.Length)
$fileStream.Close()
$bw.Close()
$ms.Dispose()

$len = (Get-Item "assets/icon.ico").Length
Write-Output "Successfully created standard Windows assets/icon.ico ($len bytes, $($sizes.Count) sizes)"
