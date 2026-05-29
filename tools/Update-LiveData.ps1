param(
  [switch]$Loop,
  [int]$IntervalSeconds = 600,
  [int]$RetrySeconds = 30,
  [switch]$NoRetryOnFailure,
  [string]$OutFile = ""
)

$ErrorActionPreference = "Stop"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

if ([string]::IsNullOrWhiteSpace($OutFile)) {
  $outFile = Join-Path $scriptDir "live-data.js"
} else {
  $outFile = $OutFile
}

function ConvertFrom-HtmlText {
  param([string]$Text)
  if ([string]::IsNullOrWhiteSpace($Text)) {
    return ""
  }
  $clean = $Text -replace "<[^>]+>", " "
  $clean = [System.Net.WebUtility]::HtmlDecode($clean)
  return (($clean -replace "\s+", " ").Trim())
}

function Invoke-WebText {
  param([string]$Uri)
  $response = Invoke-WebRequest -UseBasicParsing $Uri -Headers @{ "User-Agent" = "RainlineCityWallpaper/1.0" }

  if ($response.RawContentStream) {
    if ($response.RawContentStream.CanSeek) {
      $response.RawContentStream.Position = 0
    }

    $reader = [System.IO.StreamReader]::new($response.RawContentStream, [System.Text.Encoding]::UTF8, $true)
    try {
      return $reader.ReadToEnd()
    } finally {
      $reader.Dispose()
    }
  }

  return [string]$response.Content
}

function Invoke-WebJson {
  param(
    [string]$Uri,
    [string]$Accept = "application/json"
  )

  $headers = @{
    "User-Agent" = "RainlineCityWallpaper/1.0"
    "Accept" = $Accept
  }

  return Invoke-RestMethod -Uri $Uri -Headers $headers
}

function ConvertFrom-UnixMilliseconds {
  param($Value)
  if ($null -eq $Value) {
    return $null
  }

  return ([datetimeoffset]::FromUnixTimeMilliseconds([int64]$Value)).ToLocalTime().ToString("o")
}

function ConvertFrom-UnixSeconds {
  param($Value)
  if ($null -eq $Value) {
    return $null
  }

  return ([datetimeoffset]::FromUnixTimeSeconds([int64]$Value)).ToLocalTime().ToString("o")
}

function Get-LastValue {
  param($Values)
  if ($null -eq $Values -or $Values.Count -eq 0) {
    return $null
  }

  return [double]$Values[$Values.Count - 1]
}

function Get-NextRefreshTime {
  param(
    [datetime]$StartedAt,
    [int]$IntervalSeconds
  )

  if ($IntervalSeconds -le 0) {
    return $StartedAt
  }

  $elapsedSeconds = ($StartedAt - $StartedAt.Date).TotalSeconds
  $nextSlotSeconds = [math]::Ceiling(($elapsedSeconds + 1) / $IntervalSeconds) * $IntervalSeconds
  return $StartedAt.Date.AddSeconds($nextSlotSeconds)
}

function Test-ShouldRetryPayload {
  param($Payload)

  $errors = @($Payload.errors)
  if ($errors.Count -eq 0) {
    return $false
  }

  $errorText = $errors -join " | "
  $coreFeedsFailed = $errorText -match "Transpower:" -and $errorText -match "RNZ:"
  $manyFeedsFailed = $errors.Count -ge 3
  return $coreFeedsFailed -or $manyFeedsFailed
}

function Get-RnzDescription {
  param($Item)
  if ($Item.description -is [System.Xml.XmlElement]) {
    return $Item.description.InnerText
  }
  return [string]$Item.description
}

function Get-RnzPriorityScore {
  param($Article)

  $text = "$($Article.title) $($Article.summary) $($Article.link) $($Article.feed)".ToLowerInvariant()
  $score = 0

  if ($text -match "breaking|live updates?|just in|urgent|alert|emergency|evacuat|earthquake|flood|fire|crash|attack|police search|threat") {
    $score += 1000
  }

  if ($text -match "technology|tech|science|ai|artificial intelligence|digital|cyber|software|data|privacy|internet|media technology") {
    $score += 800
  }

  if ($text -match "politic|parliament|government|minister|coalition|national party|national-led|christopher luxon|luxon|nicola willis|willis|act party|nz first|budget|policy|bill|law") {
    $score += 650
  }

  if ($text -match "backlash|criticis|critici[sz]ed|under fire|revealed|scrutiny|probe|investigation|inquiry|resign|u-turn|climbdown|backs down|concern|warning|cuts?|cutting|shortfall|fail|scandal|leak|lobbying|conflict") {
    $score += 220
  }

  if ($text -match "health|hospital|doctor|nurse|medical|cancer|mental health|pharmac|patient|disease|screening") {
    $score += 500
  }

  return $score
}

function Get-RnzData {
  $feeds = @(
    @{ Name = "News"; Uri = "https://www.rnz.co.nz/rss/news.xml" },
    @{ Name = "Politics"; Uri = "https://www.rnz.co.nz/rss/political.xml" },
    @{ Name = "Science + Tech"; Uri = "https://www.rnz.co.nz/rss/science-and-technology.xml" },
    @{ Name = "Media + Tech"; Uri = "https://www.rnz.co.nz/rss/media-technology.xml" },
    @{ Name = "Health"; Uri = "https://www.rnz.co.nz/rss/health.xml" },
    @{ Name = "National"; Uri = "https://www.rnz.co.nz/rss/national.xml" }
  )

  $articleMap = @{}

  foreach ($feed in $feeds) {
    $rss = Invoke-WebText $feed.Uri
    [xml]$xml = $rss

    foreach ($item in @($xml.rss.channel.item | Select-Object -First 25)) {
      $title = ConvertFrom-HtmlText $item.title
      $link = [string]$item.link
      if ([string]::IsNullOrWhiteSpace($title) -or [string]::IsNullOrWhiteSpace($link) -or $link -match "/404") {
        continue
      }

      $published = if ($item.pubDate) { [datetimeoffset]::Parse($item.pubDate) } else { [datetimeoffset]::Now }
      $key = $link.ToLowerInvariant()
      $article = [ordered]@{
        rank = 0
        title = $title
        summary = (ConvertFrom-HtmlText (Get-RnzDescription $item))
        publishedAt = $published.ToString("o")
        link = $link
        feed = $feed.Name
        priorityScore = 0
      }
      $article.priorityScore = Get-RnzPriorityScore $article

      if (-not $articleMap.ContainsKey($key)) {
        $articleMap[$key] = $article
      } elseif ($article.priorityScore -gt $articleMap[$key].priorityScore) {
        $articleMap[$key] = $article
      }
    }
  }

  $articles = @(
    $articleMap.Values |
      Sort-Object `
        @{ Expression = { [int]$_["priorityScore"] }; Descending = $true },
        @{ Expression = { [datetimeoffset]::Parse($_["publishedAt"]) }; Descending = $true } |
      Select-Object -First 6
  )

  if ($articles.Count -eq 0) {
    throw "No RNZ articles found."
  }

  $rank = 1
  foreach ($article in $articles) {
    $article.rank = $rank
    $rank += 1
  }

  return [ordered]@{
    title = $articles[0].title
    summary = $articles[0].summary
    publishedAt = $articles[0].publishedAt
    link = $articles[0].link
    updatedAt = (Get-Date).ToString("o")
    articles = $articles
  }
}

function Get-GenerationCapacity {
  return [ordered]@{
    Hydro = 5415
    Geothermal = 1342
    Wind = 1393
    Solar = 470
    Gas = 1280
    "Co-Gen" = 168
    Battery = 235
    Coal = 750
    "Diesel/Oil" = 156
  }
}

function Get-TranspowerData {
  $html = Invoke-WebText "https://www.transpower.co.nz/system-operator/live-system-and-market-data/consolidated-live-data"
  $fuels = [ordered]@{}

  $pattern = '<tr id="newzealand[^"]+" class="[^"]+">\s*<td><span class="name">([^<]+)</span></td>\s*<td class="value"><span class="generation">([^<]+)</span>\s*MW</td>'
  foreach ($match in [regex]::Matches($html, $pattern, [System.Text.RegularExpressions.RegexOptions]::Singleline)) {
    $name = ConvertFrom-HtmlText $match.Groups[1].Value
    $value = [double](($match.Groups[2].Value -replace ",", "").Trim())
    $fuels[$name] = $value
  }

  if ($fuels.Count -eq 0) {
    throw "No Transpower fuel generation rows found."
  }

  $capacityMw = Get-GenerationCapacity
  $utilisation = [ordered]@{}
  foreach ($name in $fuels.Keys) {
    $current = [math]::Round([double]$fuels[$name], 0)
    $capacity = if ($capacityMw.Contains($name)) { [math]::Round([double]$capacityMw[$name], 0) } else { $null }
    $percent = if ($null -ne $capacity -and $capacity -gt 0) { [math]::Round(($current / $capacity) * 100, 1) } else { $null }
    $utilisation[$name] = [ordered]@{
      currentMw = $current
      capacityMw = $capacity
      percent = $percent
    }
  }

  $total = 0.0
  foreach ($value in $fuels.Values) {
    $total += [double]$value
  }

  $renewable = 0.0
  foreach ($name in @("Geothermal", "Hydro", "Solar", "Wind")) {
    if ($fuels.Contains($name)) {
      $renewable += [double]$fuels[$name]
    }
  }

  return [ordered]@{
    renewablePercent = [math]::Round(($renewable / $total) * 100, 1)
    renewableMw = [math]::Round($renewable, 0)
    totalMw = [math]::Round($total, 0)
    fuels = $fuels
    capacityMw = $capacityMw
    utilisation = $utilisation
    capacitySource = "User supplied generation capacity table"
    updatedAt = (Get-Date).ToString("o")
  }
}

function Get-TranspowerLoadData {
  $html = Invoke-WebText "https://www.transpower.co.nz/system-operator/live-system-and-market-data/live-load-data"
  $match = [regex]::Match($html, '<script type="application/json" data-drupal-selector="drupal-settings-json">(.*?)</script>', [System.Text.RegularExpressions.RegexOptions]::Singleline)

  if (-not $match.Success) {
    throw "No Transpower load settings block found."
  }

  $settingsJson = [System.Net.WebUtility]::HtmlDecode($match.Groups[1].Value)
  $settings = $settingsJson | ConvertFrom-Json
  $graphs = $settings.soZoneLoadGraphs

  if ($null -eq $graphs) {
    throw "No Transpower load zone data found."
  }

  $zones = @()
  $latestTimestamp = 0

  foreach ($property in $graphs.PSObject.Properties) {
    $zone = $property.Value
    $mw = Get-LastValue $zone.data.MWs
    $mvar = Get-LastValue $zone.data.MVARs
    $powerFactor = Get-LastValue $zone.data.PowerFactors

    if ($null -eq $mw) {
      continue
    }

    $timestamp = [int64]$zone.lastTimestamp
    if ($timestamp -gt $latestTimestamp) {
      $latestTimestamp = $timestamp
    }

    $zones += [ordered]@{
      zone = [string]$zone.zone
      region = [string]$zone.region
      mw = [math]::Round($mw, 0)
      mvar = if ($null -ne $mvar) { [math]::Round($mvar, 0) } else { $null }
      powerFactor = if ($null -ne $powerFactor) { [math]::Round($powerFactor, 3) } else { $null }
      updatedAt = ConvertFrom-UnixSeconds $timestamp
    }
  }

  if ($zones.Count -eq 0) {
    throw "No Transpower load zone rows found."
  }

  $totalMw = 0
  foreach ($zone in $zones) {
    $totalMw += [double]$zone.mw
  }

  return [ordered]@{
    totalMw = [math]::Round($totalMw, 0)
    updatedAt = ConvertFrom-UnixSeconds $latestTimestamp
    zones = @($zones | Sort-Object { [double]$_["mw"] } -Descending)
  }
}

function Get-GeoNetData {
  $quakeData = Invoke-WebJson "https://api.geonet.org.nz/quake?MMI=3" "application/vnd.geo+json;version=2, application/json"
  $volcanoData = Invoke-WebJson "https://api.geonet.org.nz/volcano/val" "application/vnd.geo+json;version=2, application/json"
  $capFeedText = Invoke-WebText "https://api.geonet.org.nz/cap/1.2/GPA1.0/feed/atom1.0/quake"
  [xml]$capFeed = $capFeedText

  $quakes = @(
    $quakeData.features |
      Where-Object { $_.properties.quality -ne "deleted" } |
      Sort-Object { [datetimeoffset]::Parse($_.properties.time) } -Descending |
      Select-Object -First 5 |
      ForEach-Object {
        [ordered]@{
          magnitude = [math]::Round([double]$_.properties.magnitude, 1)
          mmi = [int]$_.properties.mmi
          depthKm = [math]::Round([double]$_.properties.depth, 0)
          locality = [string]$_.properties.locality
          time = ([datetimeoffset]::Parse($_.properties.time)).ToLocalTime().ToString("o")
          quality = [string]$_.properties.quality
        }
      }
  )

  $volcanoes = @(
    $volcanoData.features |
      Where-Object { [int]$_.properties.level -gt 0 } |
      Sort-Object { [int]$_.properties.level } -Descending |
      Select-Object -First 5 |
      ForEach-Object {
        [ordered]@{
          title = [string]$_.properties.volcanoTitle
          level = [int]$_.properties.level
          colour = [string]$_.properties.acc
          activity = [string]$_.properties.activity
        }
      }
  )

  $capAlerts = @(
    $capFeed.GetElementsByTagName("entry") |
      Select-Object -First 3 |
      ForEach-Object {
        $href = ""
        foreach ($link in @($_.link)) {
          if ([string]::IsNullOrWhiteSpace($href) -or [string]$link.type -eq "application/cap+xml") {
            $href = [string]$link.href
          }
        }

        [ordered]@{
          title = ConvertFrom-HtmlText $_.title
          summary = ConvertFrom-HtmlText $_.summary
          updatedAt = if ($_.updated) { ([datetimeoffset]::Parse($_.updated)).ToLocalTime().ToString("o") } else { $null }
          link = $href
        }
      }
  )

  return [ordered]@{
    updatedAt = (Get-Date).ToString("o")
    quakes = $quakes
    volcanoes = $volcanoes
    capAlerts = $capAlerts
  }
}

function Get-WakaKotahiRoadEvents {
  $where = [uri]::EscapeDataString("status <> 'Resolved'")
  $fields = [uri]::EscapeDataString("status,eventIsland,eventDescription,eventType,impact,planned,startDate,endDate,eventModified,eventComments,locationArea")
  $uri = "https://services.arcgis.com/CXBb7LAjgIIdcsPt/arcgis/rest/services/NZTA_Highway_Information/FeatureServer/0/query?f=json&where=$where&outFields=$fields&orderByFields=eventModified%20DESC&returnGeometry=false&resultRecordCount=8"
  $data = Invoke-WebJson $uri

  $events = @(
    $data.features |
      ForEach-Object {
        $a = $_.attributes
        [ordered]@{
          status = [string]$a.status
          type = [string]$a.eventType
          description = [string]$a.eventDescription
          impact = [string]$a.impact
          location = [string]$a.locationArea
          comments = ConvertFrom-HtmlText $a.eventComments
          modifiedAt = ConvertFrom-UnixMilliseconds $a.eventModified
          startsAt = ConvertFrom-UnixMilliseconds $a.startDate
          endsAt = ConvertFrom-UnixMilliseconds $a.endDate
        }
      }
  )

  return [ordered]@{
    updatedAt = (Get-Date).ToString("o")
    events = $events
  }
}

function Get-WakaKotahiTrafficCounts {
  $where = [uri]::EscapeDataString("regionName = '08 - Manawatu-Wanganui'")
  $fields = [uri]::EscapeDataString("startDate,siteID,regionName,SiteRef,classWeight,siteDescription,laneNumber,flowDirection,trafficCount")
  $uri = "https://services.arcgis.com/CXBb7LAjgIIdcsPt/arcgis/rest/services/TMS_Telemetry_Sites/FeatureServer/0/query?f=json&where=$where&outFields=$fields&orderByFields=startDate%20DESC&returnGeometry=false&resultRecordCount=2000"
  $data = Invoke-WebJson $uri
  $rows = @($data.features | ForEach-Object { $_.attributes })

  if ($rows.Count -eq 0) {
    throw "No Waka Kotahi traffic count rows found."
  }

  $latestDate = ($rows | Measure-Object -Property startDate -Maximum).Maximum
  $latestRows = @($rows | Where-Object { $_.startDate -eq $latestDate })
  $siteGroups = $latestRows | Group-Object -Property siteID
  $sites = @()
  $total = 0.0
  $light = 0.0
  $heavy = 0.0

  foreach ($row in $latestRows) {
    $count = [double]$row.trafficCount
    $total += $count
    if ([string]$row.classWeight -eq "Heavy") {
      $heavy += $count
    } elseif ([string]$row.classWeight -eq "Light") {
      $light += $count
    }
  }

  foreach ($group in $siteGroups) {
    $siteTotal = 0.0
    $siteLight = 0.0
    $siteHeavy = 0.0
    foreach ($row in $group.Group) {
      $count = [double]$row.trafficCount
      $siteTotal += $count
      if ([string]$row.classWeight -eq "Heavy") {
        $siteHeavy += $count
      } elseif ([string]$row.classWeight -eq "Light") {
        $siteLight += $count
      }
    }

    $first = $group.Group | Select-Object -First 1
    $sites += [ordered]@{
      siteID = [int]$first.siteID
      siteRef = [string]$first.SiteRef
      description = [string]$first.siteDescription
      total = [math]::Round($siteTotal, 0)
      light = [math]::Round($siteLight, 0)
      heavy = [math]::Round($siteHeavy, 0)
    }
  }

  return [ordered]@{
    updatedAt = (Get-Date).ToString("o")
    countDate = ConvertFrom-UnixMilliseconds $latestDate
    region = "Manawatu-Wanganui"
    total = [math]::Round($total, 0)
    light = [math]::Round($light, 0)
    heavy = [math]::Round($heavy, 0)
    sites = @($sites | Sort-Object { [double]$_["total"] } -Descending | Select-Object -First 5)
  }
}

function Get-NemaAlerts {
  $rss = Invoke-WebText "https://alerthub.civildefence.govt.nz/rss/pwp"
  [xml]$xml = $rss
  $alerts = @()
  $items = @($xml.rss.channel.item) | Where-Object {
    $null -ne $_ -and -not [string]::IsNullOrWhiteSpace((ConvertFrom-HtmlText $_.title))
  }

  foreach ($item in @($items | Select-Object -First 3)) {
    if ($null -eq $item) {
      continue
    }

    $title = ConvertFrom-HtmlText $item.title
    $summary = ConvertFrom-HtmlText $item.description
    if ([string]::IsNullOrWhiteSpace($title) -and [string]::IsNullOrWhiteSpace($summary)) {
      continue
    }

    $alerts += [ordered]@{
      title = $title
      summary = $summary
      publishedAt = if ($item.pubDate) { ([datetimeoffset]::Parse($item.pubDate)).ToString("o") } else { $null }
      link = [string]$item.link
    }
  }

  return [ordered]@{
    updatedAt = (Get-Date).ToString("o")
    alerts = $alerts
  }
}

function Update-LiveData {
  $startedAt = Get-Date
  $payload = [ordered]@{
    generatedAt = $startedAt.ToString("o")
    refreshIntervalSeconds = $IntervalSeconds
    nextRefreshAt = (Get-NextRefreshTime $startedAt $IntervalSeconds).ToString("o")
    retryIntervalSeconds = $null
    nextRetryAt = $null
    transpower = $null
    rnz = $null
    geonet = $null
    wakaKotahi = [ordered]@{
      roadEvents = $null
      trafficCounts = $null
    }
    nema = $null
    errors = @()
  }

  try {
    $payload.transpower = Get-TranspowerData
    try {
      $payload.transpower["loadZones"] = Get-TranspowerLoadData
    } catch {
      $payload.errors += "Transpower load zones: $($_.Exception.Message)"
    }
  } catch {
    $payload.errors += "Transpower: $($_.Exception.Message)"
  }

  try {
    $payload.rnz = Get-RnzData
  } catch {
    $payload.errors += "RNZ: $($_.Exception.Message)"
  }

  try {
    $payload.geonet = Get-GeoNetData
  } catch {
    $payload.errors += "GeoNet: $($_.Exception.Message)"
  }

  try {
    $payload.wakaKotahi.roadEvents = Get-WakaKotahiRoadEvents
  } catch {
    $payload.errors += "Waka Kotahi road events: $($_.Exception.Message)"
  }

  try {
    $payload.wakaKotahi.trafficCounts = Get-WakaKotahiTrafficCounts
  } catch {
    $payload.errors += "Waka Kotahi traffic counts: $($_.Exception.Message)"
  }

  try {
    $payload.nema = Get-NemaAlerts
  } catch {
    $payload.errors += "NEMA: $($_.Exception.Message)"
  }

  if ((Test-ShouldRetryPayload $payload) -and -not $NoRetryOnFailure) {
    $payload.retryIntervalSeconds = $RetrySeconds
    $payload.nextRetryAt = $startedAt.AddSeconds($RetrySeconds).ToString("o")
  }

  $json = $payload | ConvertTo-Json -Depth 10 -Compress
  $js = "window.RAINLINE_DATA = $json;`nwindow.dispatchEvent(new CustomEvent('rainline-data-updated', { detail: window.RAINLINE_DATA }));`n"
  [System.IO.File]::WriteAllText($outFile, $js, [System.Text.UTF8Encoding]::new($false))

  Write-Host "Updated live-data.js at $($payload.generatedAt)"
  if ($payload.errors.Count -gt 0) {
    $payload.errors | ForEach-Object { Write-Warning $_ }
  }

  return $payload
}

do {
  $payload = Update-LiveData
  $retryAfterFailure = (-not $Loop) -and (-not $NoRetryOnFailure) -and (Test-ShouldRetryPayload $payload)

  if ($Loop -or $retryAfterFailure) {
    Start-Sleep -Seconds $(if ($retryAfterFailure) { $RetrySeconds } else { $IntervalSeconds })
  }
} while ($Loop -or $retryAfterFailure)
