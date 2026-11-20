$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Drawing
$assetDirectory=Join-Path $PSScriptRoot 'assets'
[System.IO.Directory]::CreateDirectory($assetDirectory) | Out-Null
function New-ClockImage([int]$size,[string]$destination) {
  $bitmap=[System.Drawing.Bitmap]::new($size,$size)
  $graphics=[System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode=[System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.Clear([System.Drawing.Color]::Transparent)
  $background=[System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml('#223747'))
  $accent=[System.Drawing.Pen]::new([System.Drawing.ColorTranslator]::FromHtml('#65cef7'),[single]($size*.055))
  $hand=[System.Drawing.Pen]::new([System.Drawing.ColorTranslator]::FromHtml('#eaf6fc'),[single]($size*.047))
  $accent.StartCap=[System.Drawing.Drawing2D.LineCap]::Round
  $accent.EndCap=[System.Drawing.Drawing2D.LineCap]::Round
  $hand.StartCap=[System.Drawing.Drawing2D.LineCap]::Round
  $hand.EndCap=[System.Drawing.Drawing2D.LineCap]::Round
  $graphics.FillEllipse($background,[single]($size*.025),[single]($size*.025),[single]($size*.95),[single]($size*.95))
  $graphics.DrawEllipse($accent,[single]($size*.14),[single]($size*.14),[single]($size*.72),[single]($size*.72))
  $graphics.DrawLine($hand,[single]($size*.5),[single]($size*.5),[single]($size*.5),[single]($size*.29))
  $graphics.DrawLine($hand,[single]($size*.5),[single]($size*.5),[single]($size*.67),[single]($size*.6))
  $bitmap.Save($destination,[System.Drawing.Imaging.ImageFormat]::Png)
  $graphics.Dispose();$background.Dispose();$accent.Dispose();$hand.Dispose();$bitmap.Dispose()
}
$pngPath=Join-Path $assetDirectory 'icon.png'
New-ClockImage 256 $pngPath
New-ClockImage 32 (Join-Path $assetDirectory 'tray.png')
$pngBytes=[System.IO.File]::ReadAllBytes($pngPath)
$stream=[System.IO.File]::Create((Join-Path $assetDirectory 'icon.ico'))
$writer=[System.IO.BinaryWriter]::new($stream)
$writer.Write([uint16]0);$writer.Write([uint16]1);$writer.Write([uint16]1)
$writer.Write([byte]0);$writer.Write([byte]0);$writer.Write([byte]0);$writer.Write([byte]0)
$writer.Write([uint16]1);$writer.Write([uint16]32)
$writer.Write([uint32]$pngBytes.Length);$writer.Write([uint32]22);$writer.Write($pngBytes)
$writer.Dispose();$stream.Dispose()
Write-Output 'Generated Windows application and tray icons.'
