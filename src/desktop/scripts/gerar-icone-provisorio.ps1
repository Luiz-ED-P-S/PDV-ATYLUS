# Gera o icone PROVISORIO "ATYLUS PDV" em assets/icon.ico e assets/icon.png.
# Para usar a identidade visual oficial, basta substituir assets/icon.ico (256x256 multi-tamanho) e assets/icon.png (512x512).
Add-Type -AssemblyName System.Drawing
$pasta = Join-Path $PSScriptRoot '..\assets'
New-Item -ItemType Directory -Force $pasta | Out-Null

function Novo-Bitmap([int]$t) {
  $bmp = New-Object System.Drawing.Bitmap $t, $t
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = 'AntiAlias'; $g.TextRenderingHint = 'AntiAliasGridFit'
  $g.Clear([System.Drawing.Color]::Transparent)
  $r = [int]($t * 0.22)
  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  $d = $r * 2
  $path.AddArc(0, 0, $d, $d, 180, 90); $path.AddArc($t - $d - 1, 0, $d, $d, 270, 90)
  $path.AddArc($t - $d - 1, $t - $d - 1, $d, $d, 0, 90); $path.AddArc(0, $t - $d - 1, $d, $d, 90, 90); $path.CloseFigure()
  $brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush ([System.Drawing.Point]::new(0, 0)), ([System.Drawing.Point]::new($t, $t)), ([System.Drawing.Color]::FromArgb(37, 99, 235)), ([System.Drawing.Color]::FromArgb(15, 23, 42))
  $g.FillPath($brush, $path)
  $fonte = New-Object System.Drawing.Font 'Segoe UI', ([single]($t * 0.52)), ([System.Drawing.FontStyle]::Bold), ([System.Drawing.GraphicsUnit]::Pixel)
  $fmt = New-Object System.Drawing.StringFormat; $fmt.Alignment = 'Center'; $fmt.LineAlignment = 'Center'
  $g.DrawString('A', $fonte, [System.Drawing.Brushes]::White, (New-Object System.Drawing.RectangleF 0, 0, $t, ($t * 0.95)), $fmt)
  $g.Dispose()
  return $bmp
}

$tamanhos = 16, 24, 32, 48, 64, 128, 256
$pngs = @()
foreach ($t in $tamanhos) {
  $bmp = Novo-Bitmap $t
  $ms = New-Object System.IO.MemoryStream
  $bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
  $pngs += , @{ T = $t; B = $ms.ToArray() }
  $bmp.Dispose()
}
$grande = Novo-Bitmap 512
$grande.Save((Join-Path $pasta 'icon.png'), [System.Drawing.Imaging.ImageFormat]::Png)
$grande.Dispose()

$fs = [System.IO.File]::Create((Join-Path $pasta 'icon.ico'))
$w = New-Object System.IO.BinaryWriter $fs
$w.Write([uint16]0); $w.Write([uint16]1); $w.Write([uint16]$pngs.Count)
$offset = 6 + 16 * $pngs.Count
foreach ($p in $pngs) {
  $dim = if ($p.T -ge 256) { 0 } else { $p.T }
  $w.Write([byte]$dim); $w.Write([byte]$dim); $w.Write([byte]0); $w.Write([byte]0)
  $w.Write([uint16]1); $w.Write([uint16]32); $w.Write([uint32]$p.B.Length); $w.Write([uint32]$offset)
  $offset += $p.B.Length
}
foreach ($p in $pngs) { $w.Write($p.B) }
$w.Close(); $fs.Close()
Write-Host 'Icone provisorio gerado em assets/'
