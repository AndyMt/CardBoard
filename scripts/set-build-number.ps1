if ($env:BUILD_NUMBER) {
  $env:BUILD_NUMBER
} else {
  $bn = (Get-Date -Format 'yyyyMMddHHmm')
  $env:BUILD_NUMBER = $bn
  $bn
}
