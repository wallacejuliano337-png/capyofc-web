Add-Type -AssemblyName System.Drawing
New-Item -ItemType Directory -Force assets | Out-Null
$bitmap=New-Object System.Drawing.Bitmap 256,256
$g=[System.Drawing.Graphics]::FromImage($bitmap)
$g.SmoothingMode=[System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g.Clear([System.Drawing.Color]::FromArgb(20,21,26))
$red=New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(232,57,74))
$points=[System.Drawing.Point[]]@([System.Drawing.Point]::new(38,30),[System.Drawing.Point]::new(218,30),[System.Drawing.Point]::new(218,176),[System.Drawing.Point]::new(128,233),[System.Drawing.Point]::new(38,176))
$g.FillPolygon($red,$points)
$font=New-Object System.Drawing.Font 'Arial',116,([System.Drawing.FontStyle]::Bold)
$g.DrawString('L',$font,[System.Drawing.Brushes]::White,55,28)
$bitmap.Save('D:\LYC-Arena\assets\icon.png',[System.Drawing.Imaging.ImageFormat]::Png)
$font.Dispose()
$red.Dispose()
$g.Dispose()
$bitmap.Dispose()
