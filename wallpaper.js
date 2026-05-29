const video = document.getElementById("background-video");

const data = {
  generatedAt: null,
  nextRefreshAt: null,
  refreshIntervalSeconds: 600,
  renewables: null,
  transpowerLoad: null,
  newsArticles: [],
  newsUpdatedAt: null,
  geonet: null,
  wakaKotahi: {
    roadEvents: null,
    trafficCounts: null,
  },
  nemaAlerts: [],
  errors: [],
  nextRetryAt: null,
  retryIntervalSeconds: 30,
};

const sign = {
  shell: document.querySelector(".billboard-shell"),
  source: document.querySelector("[data-sign-source]"),
  title: document.querySelector("[data-sign-title]"),
  sponsor: document.querySelector("[data-sign-sponsor]"),
  heartbeatLabel: document.querySelector("[data-heartbeat-label]"),
  heartbeatBars: document.querySelector("[data-heartbeat-bars]"),
  heartbeatFill: document.querySelector("[data-heartbeat-fill]"),
  body: document.querySelector("[data-sign-body]"),
  ticker: document.querySelector("[data-sign-ticker]"),
  time: document.querySelector("[data-sign-time]"),
  transition: document.querySelector("[data-glitch-transition]"),
  transitionKicker: document.querySelector("[data-glitch-kicker]"),
  transitionTitle: document.querySelector("[data-glitch-title]"),
  transitionCopy: document.querySelector("[data-glitch-copy]"),
};

const paidAd = {
  slot: document.querySelector(".paid-ad-slot"),
  frame: document.querySelector("[data-paid-ad-frame]"),
  tag: document.querySelector("[data-paid-ad-tag]"),
  logo: document.querySelector("[data-paid-ad-logo]"),
  name: document.querySelector("[data-paid-ad-name]"),
  copy: document.querySelector("[data-paid-ad-copy]"),
};

let liveDataScript = null;
let rotationPlan = null;
let currentRenderedKey = "";
let transitionTimers = [];
let currentHeartbeat = null;
let currentPaidAd = null;
let nextLocalPollAt = Date.now() + 30000;
const defaultSlideDurationMs = 10000;
const generationSlideDurationMs = 20000;
const refreshGraceMs = 90000;
const rnzMaxArticles = 6;
const rareEventChance = 0.18;
const fuelOrder = ["Hydro", "Geothermal", "Wind", "Solar", "Gas", "Co-Gen", "Battery", "Coal", "Diesel/Oil"];
const localDataSources = Array.from(new Set([
  window.RAINLINE_LIVE_DATA_URL,
  "./live-data.js",
].filter(Boolean)));
const query = new URLSearchParams(window.location.search);
const forcedSlide = query.get("slide");
const forcedIssue = query.has("issue");
const forcedAd = query.get("ad");
const transitionClasses = ["glitch-flash-a", "glitch-flash-b", "glitch-flash-c", "glitch-flash-d"];
const transitionAds = [
  { kicker: "NEXUS DISTRICTS", title: "THE CITY NEVER SLEEPS", copy: "Municipal dreams at commercial speed" },
  { kicker: "AUGMENT", title: "UPGRADE YOUR SENSES", copy: "See the rain before it falls" },
  { kicker: "RAINLINE", title: "SIGNAL SHIFT", copy: "Data blooms after midnight" },
  { kicker: "NEON AUTHORITY", title: "NOTICE THE FUTURE", copy: "Compliance never looked this good" },
  { kicker: "CIVIC ADSTREAM", title: "STAY LIT", copy: "Your attention is appreciated" },
  { kicker: "SYNTHVISION", title: "RETUNE YOUR EYES", copy: "Sharper nights, brighter lies" },
];
const sponsors = [
  "NEXUS WEATHER GRID // LIVE URBAN CONDITIONS",
  "RAINLINE SYSTEMS // CITY DATA, ALWAYS WATCHING",
  "CHROMA TRANSIT // MOVE THROUGH THE NIGHT",
  "SYNTHVISION OPTICS // RETUNE YOUR EYES",
  "NEON AUTHORITY // NOTICE THE FUTURE",
  "AUGMENT // UPGRADE YOUR SENSES",
];
const rareEvents = [
  { source: "SIGN EVENT", title: "NICE CATCH", copy: "SIGN CALIBRATION PASSED" },
  { source: "CITY AI", title: "CITY AI OBSERVING", copy: "PLEASE CONTINUE." },
  { source: "RAINLINE SYS", title: "GHOST PIXEL FOUND", copy: "NO ACTION REQUIRED" },
  { source: "NEXUS AD", title: "AUGMENT", copy: "UPGRADE YOUR SENSES" },
];

function simpleIconLogo(label, fill, path) {
  return `
    <svg viewBox="0 0 24 24" role="img" aria-label="${escapeHtml(label)}">
      <path d="${path}" fill="${fill}"></path>
    </svg>
  `;
}

function wordmarkLogo(label, fill, text) {
  return `
    <svg viewBox="0 0 180 58" role="img" aria-label="${escapeHtml(label)}">
      <text class="logo-word" x="90" y="38" fill="${fill}">${escapeHtml(text)}</text>
    </svg>
  `;
}

const paidAds = [
  {
    tag: "REAL TASTE // REAL MEMORIES",
    logoHtml: simpleIconLogo("Coca-Cola", "#ff2645", "M16.813 8.814s-.45.18-.973.756c-.524.577-.828 1.225-.603 1.397.087.066.287.079.65-.25a2.864 2.864 0 00.766-1.063c.234-.57.16-.833.16-.84m2.863 1.038c-.581-.299-1.006-.664-1.448-.89-.422-.216-.695-.307-1.036-.261a1.057 1.057 0 00-.14.035s.176.6-.523 1.607c-.708 1.022-1.35 1.015-1.533.734-.191-.296.056-.9.468-1.437.432-.562 1.19-1.028 1.19-1.028s-.241-.148-.835.19c-.58.326-1.577 1.107-2.502 2.423-.926 1.316-1.11 2.04-1.242 2.61-.132.57-.012 1.18.62 1.18s1.368-.964 1.576-1.299c.386-.624.637-1.581.112-1.45-.259.065-.468.351-.6.627a2.683 2.683 0 00-.19.554 2.185 2.185 0 00-.513.298 3.788 3.788 0 00-.486.43s.002-.456.365-1.194c.364-.737 1.03-1.074 1.408-1.106.34-.027.783.262.408 1.327-.375 1.065-1.483 2.36-2.646 2.376-1.073.015-1.776-1.355-.282-3.745C13.501 9.19 15.441 8.38 16.07 8.29c.63-.09.835.187.835.187a2.709 2.709 0 011.197-.197c.77.052 1.364.596 2.15.979-.205.195-.4.4-.575.592m3.454-.89c-.533.342-1.27.652-1.979.586-.179.185-.371.4-.563.634 1.228.243 2.305-.519 2.877-1.167A3.82 3.82 0 0024 8.248a4.792 4.792 0 01-.869.714m-1.636 3.462a.268.268 0 00.023-.051.124.124 0 00-.113-.108c-.117-.005-.277.017-.695.48a6.303 6.303 0 00-.89 1.263c-.24.438-.337.764-.2.848a.199.199 0 00.146.015c.093-.022.199-.11.36-.295.075-.088.158-.212.258-.349.277-.376.973-1.563 1.111-1.803m-4.349.504c.07-.182.159-.541-.026-.682-.199-.15-.705.201-.708.561-.003.369.357.535.443.559.05.013.066.01.09-.029a3.284 3.284 0 00.201-.409m-.383.67a1.531 1.531 0 01-.348-.222 1.116 1.116 0 01-.26-.317c-.008-.012-.015-.003-.023.008-.007.01-.039.039-.309.434-.27.396-.684 1.216-.31 1.355.241.09.641-.331.86-.61a5.21 5.21 0 00.402-.614c.012-.023 0-.029-.012-.034m4.258.947c-.102.163-.218.476.117.281.41-.236.994-1.123.994-1.123h.265a8.88 8.88 0 01-.803 1.054c-.415.46-.922.879-1.28.837-.416-.048-.286-.596-.286-.596s-.596.635-1.01.59c-.557-.062-.387-.751-.387-.751s-.63.774-1.06.75c-.673-.04-.504-.859-.316-1.436.1-.308.193-.55.193-.55s-.067.017-.21.038c-.076.011-.212.019-.212.019s-.28.495-.505.792c-.224.297-1.178 1.322-1.74 1.117-.518-.19-.346-.984-.044-1.615.44-.92 1.68-2.243 2.396-2.068.741.18.017 1.532.017 1.532s0 .005.007.009c.015.005.054.01.143-.008a1.605 1.605 0 00.271-.08s.746-1.561 1.569-2.583c.823-1.02 2.465-2.78 3.11-2.354.156.105.086.465-.126.902a2.891 2.891 0 01-.291.078c.142-.258.236-.475.264-.627.097-.528-1.135.585-2.015 1.78a16.594 16.594 0 00-1.409 2.28 3.86 3.86 0 00.454-.324 13.002 13.002 0 001.118-1.043 12.169 12.169 0 00.951-1.098 2.58 2.58 0 00.28-.029 12.054 12.054 0 01-1.05 1.24c-.35.355-.73.737-1.061 1.015a8.84 8.84 0 01-.931.691s-.77 1.553-.351 1.652c.246.06.732-.69.732-.69s.635-.967 1.017-1.404c.522-.593.97-.936 1.42-.942.261-.005.415.273.415.273l.123-.19h.757s-1.414 2.398-1.527 2.579m2.111-5.58c-.533.341-1.27.651-1.979.585-.18.185-.371.4-.564.634 1.229.243 2.305-.518 2.878-1.167A3.82 3.82 0 0024 8.248a4.792 4.792 0 01-.869.714m-10.63 1.177h-.72l-.407.658h.72zm-3.41 2.277c.307-.42 1.152-1.891 1.152-1.891a.124.124 0 00-.112-.108c-.117-.006-.312.034-.7.519-.387.485-.688.87-.907 1.272-.24.438-.346.747-.207.831a.205.205 0 00.144.015c.09-.022.208-.113.369-.298a5.57 5.57 0 00.262-.34m-3.863-1.99c-.199-.15-.705.201-.708.56-.003.369.456.482.515.484a.09.09 0 00.05-.01.06.06 0 00.024-.027 3.483 3.483 0 00.146-.325c.07-.183.158-.541-.027-.682m-.3 1.27a1.678 1.678 0 01-.39-.18.812.812 0 01-.279-.309c-.007-.012-.015-.003-.022.008-.007.01-.047.061-.318.458-.27.398-.672 1.21-.296 1.35.24.09.644-.334.864-.612a7.24 7.24 0 00.455-.681c.009-.024 0-.03-.014-.034m5.88.244h.263s-1.321 1.912-2.068 1.823c-.416-.049-.293-.563-.293-.563s-.585.685-1.123.546c-.487-.125-.172-.936-.172-.936-.056.022-1.111 1.211-1.853.926-.776-.3-.373-1.296-.225-1.595.125-.253.263-.499.263-.499s-.119.034-.195.051l-.186.04s-.367.596-.591.894c-.225.297-1.178 1.32-1.74 1.117-.562-.204-.423-.99-.107-1.615.512-1.012 1.726-2.256 2.458-2.068.739.189.127 1.388.127 1.388s.147.019.5-.222c.507-.346 1.176-1.277 1.901-1.167.342.051.66.4.225 1.064-.139.213-.372.403-.55.215-.111-.118-.014-.33.103-.477a.457.457 0 01.39-.179s.12-.273-.185-.269c-.247.005-.871.58-1.223 1.16-.323.533-.813 1.441-.322 1.639.451.182 1.309-.836 1.706-1.37.397-.533 1.302-1.742 2.062-1.79.261-.017.417.221.417.221l.088-.139h.759s-1.43 2.387-1.542 2.567c-.088.141-.204.46.117.281.322-.178.996-1.043.996-1.043m-.414 3.824a3.144 3.144 0 00-1.908-.557 1.17 1.17 0 00-.93.504c-.29-.505-.862-.815-1.747-.808-1.43.016-2.849.676-3.972.675-1.077 0-1.863-.677-1.837-1.88.047-2.109 1.83-4.009 3.16-4.864.767-.49 1.409-.637 1.828-.59.306.034.674.388.442.909-.341.761-.812.699-.795.335.01-.237.168-.386.286-.469a.582.582 0 01.278-.068c.068-.057.117-.474-.429-.337-.546.137-1.21.676-1.84 1.371-.63.696-1.61 2.011-1.852 3.392-.113.64-.039 1.808 1.48 1.795 1.287-.01 3.185-.859 4.929-.841a3.34 3.34 0 011.725.472c.451.278.992.684 1.184.961"),
    name: "COCA-COLA",
    copy: "SINCE BEFORE WW III",
    primary: "#ffffff",
    secondary: "#ff2645",
    primarySoft: "rgba(255, 255, 255, 0.28)",
    secondarySoft: "rgba(255, 38, 69, 0.24)",
  },
  {
    tag: "MIDNIGHT BUCKET",
    logoHtml: simpleIconLogo("KFC", "#f6fbff", "M21.893 8.23c-4.187.001-5.249 2.365-5.42 3.97-.194 1.802 1.053 3.57 4.127 3.57 1.294 0 2.14-.225 2.44-.32a.215.215 0 00.147-.166l.173-.91a.184.184 0 00-.236-.21c-.336.106-.93.252-1.685.252-1.469 0-2.53-.882-2.395-2.4.13-1.47 1.121-2.59 2.485-2.59.82 0 1.183.43 1.156 1.003v.033a.184.184 0 00.182.193h.557c.086 0 .16-.06.18-.143l.39-1.76a.215.215 0 00-.15-.255 7.21 7.21 0 00-1.95-.266zm-20.157.116a.2.2 0 00-.195.156l-.108.484a.198.198 0 00.13.23l.033.01c.208.082.45.266.348.748l-.792 3.62c-.207.987-.542 1.19-.86 1.226h-.01a.2.2 0 00-.176.157l-.102.464a.192.192 0 00.187.233h3.487c.085 0 .159-.06.177-.142l.12-.543a.184.184 0 00-.112-.21l-.022-.01c-.177-.07-.418-.224-.356-.51l.405-1.85c1.389 2.535 1.848 3.266 3.514 3.265H8.91a.181.181 0 00.177-.142l.105-.47a.195.195 0 00-.186-.238c-.376-.006-.56-.093-.935-.575l-1.932-2.614 2.51-2.088c.337-.264.748-.338.976-.368l.022-.002a.185.185 0 00.163-.144l.103-.464a.184.184 0 00-.18-.223h-3.02a.199.199 0 00-.193.155l-.102.46a.2.2 0 00.138.235c.178.069.217.24.063.366L4.046 11.7l.44-2.014a.683.683 0 01.477-.487l.025-.008a.199.199 0 00.135-.147l.106-.477a.181.181 0 00-.177-.22zm8.88 0a.2.2 0 00-.194.156l-.107.483a.19.19 0 00.122.221l.02.008c.204.077.487.274.364.758l-1.21 5.48a.182.182 0 00.178.222h2.777c.086 0 .16-.06.179-.143l.12-.547a.174.174 0 00-.098-.196 1.558 1.558 0 01-.027-.013c-.176-.086-.438-.285-.35-.67.009-.05.27-1.24.27-1.24h2.362c.086 0 .16-.06.18-.143l.221-1a.183.183 0 00-.18-.224h-2.28l.427-1.94 1.592-.003c.515 0 .672.27.642.728l-.002.024a.184.184 0 00.183.205h.587c.086 0 .16-.06.178-.144l.4-1.8a.184.184 0 00-.18-.222z"),
    name: "KFC",
    copy: "HOT FOOD // COLD CITY",
    primary: "#f6fbff",
    secondary: "#ff2a35",
    primarySoft: "rgba(246, 251, 255, 0.22)",
    secondarySoft: "rgba(255, 42, 53, 0.24)",
  },
  {
    tag: "NETWORK BUY",
    logoHtml: `
      <svg viewBox="0 0 165 58" role="img" aria-label="Spark">
        <text class="logo-word" x="82" y="38" fill="#ff4fd8" style="font-size:34px;">spark</text>
        <circle cx="142" cy="18" r="5" fill="#62f0ff"/>
      </svg>
    `,
    name: "SPARK",
    copy: "HELLO TOMORROW",
    primary: "#ff4fd8",
    secondary: "#62f0ff",
    primarySoft: "rgba(255, 79, 216, 0.26)",
    secondarySoft: "rgba(98, 240, 255, 0.2)",
  },
  {
    tag: "CHARGE PARTNER",
    logoHtml: `
      <svg viewBox="0 0 165 58" role="img" aria-label="bp charge">
        <g transform="translate(34 28)">
          <ellipse cx="0" cy="-16" rx="5.5" ry="11" fill="#79be20"/>
          <ellipse cx="0" cy="-16" rx="5.5" ry="11" fill="#79be20" transform="rotate(45)"/>
          <ellipse cx="0" cy="-16" rx="5.5" ry="11" fill="#79be20" transform="rotate(90)"/>
          <ellipse cx="0" cy="-16" rx="5.5" ry="11" fill="#79be20" transform="rotate(135)"/>
          <ellipse cx="0" cy="-16" rx="5.5" ry="11" fill="#79be20" transform="rotate(180)"/>
          <ellipse cx="0" cy="-16" rx="5.5" ry="11" fill="#79be20" transform="rotate(225)"/>
          <ellipse cx="0" cy="-16" rx="5.5" ry="11" fill="#79be20" transform="rotate(270)"/>
          <ellipse cx="0" cy="-16" rx="5.5" ry="11" fill="#79be20" transform="rotate(315)"/>
          <circle cx="0" cy="0" r="12" fill="#fff06d"/>
          <circle cx="0" cy="0" r="6" fill="#149447"/>
        </g>
        <text x="85" y="28" fill="#78ff84" text-anchor="middle" style="font-size:26px;font-weight:900;font-family:'Segoe UI',Arial,sans-serif;">bp</text>
        <text x="105" y="45" fill="#fff06d" text-anchor="middle" style="font-size:15px;font-weight:850;font-family:'Segoe UI',Arial,sans-serif;">charge</text>
      </svg>
    `,
    name: "BP CHARGE",
    copy: "RAPID EV CHARGING",
    primary: "#78ff84",
    secondary: "#fff06d",
    primarySoft: "rgba(120, 255, 132, 0.24)",
    secondarySoft: "rgba(255, 240, 109, 0.22)",
  },
  {
    tag: "DISTRICT AD",
    logoHtml: simpleIconLogo("Nike", "#ffffff", "M24 7.8L6.442 15.276c-1.456.616-2.679.925-3.668.925-1.12 0-1.933-.392-2.437-1.177-.317-.504-.41-1.143-.28-1.918.13-.775.476-1.6 1.036-2.478.467-.71 1.232-1.643 2.297-2.8a6.122 6.122 0 00-.784 1.848c-.28 1.195-.028 2.072.756 2.632.373.261.886.392 1.54.392.522 0 1.11-.084 1.764-.252L24 7.8z"),
    name: "NIKE",
    copy: "JUST DO IT",
    primary: "#ffffff",
    secondary: "#62f0ff",
    primarySoft: "rgba(255, 255, 255, 0.24)",
    secondarySoft: "rgba(98, 240, 255, 0.18)",
  },
  {
    tag: "SCREEN PARTNER",
    logoHtml: simpleIconLogo("Samsung", "#8ec8ff", "M19.8166 10.2808l.0459 2.6934h-.023l-.7793-2.6934h-1.2837v3.3925h.8481l-.0458-2.785h.023l.8366 2.785h1.2264v-3.3925zm-16.149 0l-.6418 3.427h.9284l.4699-3.1175h.0229l.4585 3.1174h.9169l-.6304-3.4269zm5.1805 0l-.424 2.6132h-.023l-.424-2.6132H6.5788l-.0688 3.427h.8596l.023-3.0832h.0114l.573 3.0831h.8711l.5731-3.083h.023l.0228 3.083h.8596l-.0802-3.4269zm-7.2664 2.4527c.0343.0802.0229.1949.0114.2522-.0229.1146-.1031.2292-.3324.2292-.2177 0-.3438-.126-.3438-.3095v-.3323H0v.2636c0 .7679.6074.9971 1.2493.9971.6189 0 1.1346-.2178 1.2149-.7794.0458-.298.0114-.4928 0-.5616-.1605-.722-1.467-.9283-1.5588-1.3295-.0114-.0688-.0114-.1375 0-.1834.023-.1146.1032-.2292.3095-.2292.2063 0 .321.126.321.3095v.2063h.8595v-.2407c0-.745-.6762-.8596-1.1576-.8596-.6074 0-1.1117.2063-1.2034.7564-.023.149-.0344.2866.0114.4585.1376.7106 1.364.9169 1.5358 1.3524m11.152 0c.0343.0803.0228.1834.0114.2522-.023.1146-.1032.2292-.3324.2292-.2178 0-.3438-.126-.3438-.3095v-.3323h-.917v.2636c0 .7564.596.9857 1.2379.9857.6189 0 1.1232-.2063 1.2034-.7794.0459-.298.0115-.4814 0-.5616-.1375-.7106-1.4327-.9284-1.5243-1.318-.0115-.0688-.0115-.1376 0-.1835.0229-.1146.1031-.2292.3094-.2292.1948 0 .321.126.321.3095v.2063h.848v-.2407c0-.745-.6647-.8596-1.146-.8596-.6075 0-1.1004.1948-1.192.7564-.023.149-.023.2866.0114.4585.1376.7106 1.341.9054 1.513 1.3524m2.8882.4585c.2407 0 .3094-.1605.3323-.2522.0115-.0343.0115-.0917.0115-.126v-2.533h.871v2.4642c0 .0688 0 .1948-.0114.2292-.0573.6419-.5616.8482-1.192.8482-.6303 0-1.1346-.2063-1.192-.8482 0-.0344-.0114-.1604-.0114-.2292v-2.4642h.871v2.533c0 .0458 0 .0916.0115.126 0 .0917.0688.2522.3095.2522m7.1518-.0344c.2522 0 .3324-.1605.3553-.2522.0115-.0343.0115-.0917.0115-.126v-.4929h-.3553v-.5043H24v.917c0 .0687 0 .1145-.0115.2292-.0573.6303-.596.8481-1.2034.8481-.6075 0-1.1461-.2178-1.2034-.8481-.0115-.1147-.0115-.1605-.0115-.2293v-1.444c0-.0574.0115-.172.0115-.2293.0802-.6419.596-.8482 1.2034-.8482s1.1347.2063 1.2034.8482c.0115.1031.0115.2292.0115.2292v.1146h-.8596v-.1948s0-.0803-.0115-.1261c-.0114-.0802-.0802-.2521-.3438-.2521-.2521 0-.321.1604-.3438.2521-.0115.0458-.0115.1032-.0115.1605v1.5702c0 .0458 0 .0916.0115.126 0 .0917.0917.2522.3323.2522"),
    name: "SAMSUNG",
    copy: "GALAXY AI",
    primary: "#8ec8ff",
    secondary: "#3a63ff",
    primarySoft: "rgba(142, 200, 255, 0.28)",
    secondarySoft: "rgba(58, 99, 255, 0.2)",
  },
  {
    tag: "GALAXY OPTIC",
    logoHtml: simpleIconLogo("Samsung", "#c7d4ff", "M19.8166 10.2808l.0459 2.6934h-.023l-.7793-2.6934h-1.2837v3.3925h.8481l-.0458-2.785h.023l.8366 2.785h1.2264v-3.3925zm-16.149 0l-.6418 3.427h.9284l.4699-3.1175h.0229l.4585 3.1174h.9169l-.6304-3.4269zm5.1805 0l-.424 2.6132h-.023l-.424-2.6132H6.5788l-.0688 3.427h.8596l.023-3.0832h.0114l.573 3.0831h.8711l.5731-3.083h.023l.0228 3.083h.8596l-.0802-3.4269zm-7.2664 2.4527c.0343.0802.0229.1949.0114.2522-.0229.1146-.1031.2292-.3324.2292-.2177 0-.3438-.126-.3438-.3095v-.3323H0v.2636c0 .7679.6074.9971 1.2493.9971.6189 0 1.1346-.2178 1.2149-.7794.0458-.298.0114-.4928 0-.5616-.1605-.722-1.467-.9283-1.5588-1.3295-.0114-.0688-.0114-.1375 0-.1834.023-.1146.1032-.2292.3095-.2292.2063 0 .321.126.321.3095v.2063h.8595v-.2407c0-.745-.6762-.8596-1.1576-.8596-.6074 0-1.1117.2063-1.2034.7564-.023.149-.0344.2866.0114.4585.1376.7106 1.364.9169 1.5358 1.3524m11.152 0c.0343.0803.0228.1834.0114.2522-.023.1146-.1032.2292-.3324.2292-.2178 0-.3438-.126-.3438-.3095v-.3323h-.917v.2636c0 .7564.596.9857 1.2379.9857.6189 0 1.1232-.2063 1.2034-.7794.0459-.298.0115-.4814 0-.5616-.1375-.7106-1.4327-.9284-1.5243-1.318-.0115-.0688-.0115-.1376 0-.1835.0229-.1146.1031-.2292.3094-.2292.1948 0 .321.126.321.3095v.2063h.848v-.2407c0-.745-.6647-.8596-1.146-.8596-.6075 0-1.1004.1948-1.192.7564-.023.149-.023.2866.0114.4585.1376.7106 1.341.9054 1.513 1.3524m2.8882.4585c.2407 0 .3094-.1605.3323-.2522.0115-.0343.0115-.0917.0115-.126v-2.533h.871v2.4642c0 .0688 0 .1948-.0114.2292-.0573.6419-.5616.8482-1.192.8482-.6303 0-1.1346-.2063-1.192-.8482 0-.0344-.0114-.1604-.0114-.2292v-2.4642h.871v2.533c0 .0458 0 .0916.0115.126 0 .0917.0688.2522.3095.2522m7.1518-.0344c.2522 0 .3324-.1605.3553-.2522.0115-.0343.0115-.0917.0115-.126v-.4929h-.3553v-.5043H24v.917c0 .0687 0 .1145-.0115.2292-.0573.6303-.596.8481-1.2034.8481-.6075 0-1.1461-.2178-1.2034-.8481-.0115-.1147-.0115-.1605-.0115-.2293v-1.444c0-.0574.0115-.172.0115-.2293.0802-.6419.596-.8482 1.2034-.8482s1.1347.2063 1.2034.8482c.0115.1031.0115.2292.0115.2292v.1146h-.8596v-.1948s0-.0803-.0115-.1261c-.0114-.0802-.0802-.2521-.3438-.2521-.2521 0-.321.1604-.3438.2521-.0115.0458-.0115.1032-.0115.1605v1.5702c0 .0458 0 .0916.0115.126 0 .0917.0917.2522.3323.2522"),
    name: "SAMSUNG",
    copy: "SEE THE NIGHT DIFFERENTLY",
    primary: "#c7d4ff",
    secondary: "#b05cff",
    primarySoft: "rgba(199, 212, 255, 0.26)",
    secondarySoft: "rgba(176, 92, 255, 0.24)",
  },
  {
    tag: "THINK LESS.",
    logoHtml: simpleIconLogo("Apple", "#f7fbff", "M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701"),
    name: "APPLE",
    copy: "BE A SHEEP",
    primary: "#f7fbff",
    secondary: "#d9d9e8",
    primarySoft: "rgba(247, 251, 255, 0.24)",
    secondarySoft: "rgba(217, 217, 232, 0.18)",
  },
  {
    tag: "DREAM FEED AVAILABLE",
    logoHtml: simpleIconLogo("Netflix", "#E50914", "m5.398 0 8.348 23.602c2.346.059 4.856.398 4.856.398L10.113 0H5.398zm8.489 0v9.172l4.715 13.33V0h-4.715zM5.398 1.5V24c1.873-.225 2.81-.312 4.715-.398V14.83L5.398 1.5z"),
    name: "NETFLIX",
    copy: "CONTINUE WATCHING: YOUR LIFE, BUT NICE",
    primary: "#ff2634",
    secondary: "#f7fbff",
    primarySoft: "rgba(255, 38, 52, 0.28)",
    secondarySoft: "rgba(247, 251, 255, 0.18)",
  },
  {
    tag: "PUBLIC SAFETY NOTICE",
    logoHtml: wordmarkLogo("Public Safety Notice", "#ffea84", "02:00"),
    name: "CURFEW BEGINS",
    copy: "STAY IN LIT DISTRICTS",
    primary: "#ffea84",
    secondary: "#ff3058",
    primarySoft: "rgba(255, 234, 132, 0.26)",
    secondarySoft: "rgba(255, 48, 88, 0.26)",
  },
  {
    tag: "MOBILITY BUY",
    logoHtml: simpleIconLogo("Toyota", "#f6fbff", "M12 3.848C5.223 3.848 0 7.298 0 12c0 4.702 5.224 8.152 12 8.152S24 16.702 24 12c0-4.702-5.223-8.152-12-8.152zm7.334 3.839c0 1.08-1.725 1.913-4.488 2.246-.26-2.58-1.005-4.279-1.963-4.913 2.948.184 6.45 1.227 6.45 2.667zM12 16.401c-.96 0-1.746-1.5-1.808-4.389.577.047 1.18.072 1.808.072.628 0 1.23-.025 1.807-.072-.061 2.89-.847 4.389-1.807 4.389zm0-6.308c-.59 0-1.155-.019-1.69-.054.261-1.728.92-3.15 1.69-3.15.77 0 1.428 1.422 1.689 3.15-.535.034-1.099.054-1.689.054zm-.882-5.075c-.956.633-1.706 2.333-1.964 4.915C6.391 9.6 4.665 8.767 4.665 7.687c0-1.44 3.504-2.49 6.453-2.669zM2.037 11.68a5.265 5.265 0 011.048-3.164c.27 1.547 2.522 2.881 5.972 3.37V12c0 3.772.879 6.203 2.087 6.97-5.107-.321-9.107-3.48-9.107-7.29zm10.823 7.29c1.207-.767 2.087-3.198 2.087-6.97v-.115c3.447-.488 5.704-1.826 5.972-3.37a5.26 5.26 0 011.049 3.165c-.004 3.81-4.008 6.969-9.109 7.29z"),
    name: "TOYOTA",
    copy: "LET'S GO PLACES",
    primary: "#f6fbff",
    secondary: "#ff335a",
    primarySoft: "rgba(246, 251, 255, 0.22)",
    secondarySoft: "rgba(255, 51, 90, 0.22)",
  },
];

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function stripHtml(value) {
  return (value || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, "\"")
    .replace(/\s+/g, " ")
    .trim();
}

function truncateText(value, maxLength) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, Math.max(0, maxLength - 1)).trim()}...`;
}

function randomChoice(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function clampNumber(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function hashText(value) {
  return String(value || "").split("").reduce((hash, char) => ((hash << 5) - hash + char.charCodeAt(0)) | 0, 0);
}

function deterministicChoice(items, seed) {
  return items[Math.abs(hashText(seed)) % items.length];
}

function toDate(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function normaliseDate(value) {
  const date = toDate(value);
  return date ? date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "waiting";
}

function formatMw(value) {
  const number = Number(value || 0);
  return `${number.toLocaleString(undefined, { maximumFractionDigits: 0 })} MW`;
}

function formatCompactMw(value) {
  return Number(value || 0).toLocaleString(undefined, {
    maximumFractionDigits: 0,
    useGrouping: false,
  });
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString(undefined, {
    maximumFractionDigits: 0,
  });
}

function formatAge(value) {
  const date = toDate(value);
  if (!date) return "live";
  const diffMs = Math.max(0, Date.now() - date.getTime());
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

function formatSignalAge() {
  const date = data.generatedAt;
  if (!date) return "SIGNAL AGE --";
  const minutes = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60000));
  if (minutes < 60) return `SIGNAL AGE ${String(minutes).padStart(2, "0")}M`;
  return `SIGNAL AGE ${Math.floor(minutes / 60)}H`;
}

function asciiBars(value, total = 10) {
  const filled = Math.max(0, Math.min(total, Math.round(value)));
  return `${"#".repeat(filled)}${"-".repeat(total - filled)}`;
}

function bars(value, total = 10) {
  const filled = Math.max(0, Math.min(total, Math.round(value)));
  return `${"█".repeat(filled)}${"░".repeat(total - filled)}`;
}

function inlineMeter(percent) {
  const safePercent = Math.max(0, Math.min(100, Number(percent) || 0));
  return `<em class="inline-meter" aria-hidden="true"><i style="width:${safePercent.toFixed(0)}%"></i></em>`;
}

function glitchText(value) {
  const text = String(value || "");
  if (text.length < 5) return text;
  const clean = text.replace(/\s+/g, " ");
  const index = Math.max(2, Math.min(clean.length - 2, Math.floor(clean.length * 0.38)));
  const variants = ["//", "▓", "::", "█", "\\\\"];
  return `${clean.slice(0, index)}${randomChoice(variants)}${clean.slice(index)}`;
}

function sentenceCase(value) {
  const text = String(value || "").trim();
  return text ? `${text[0].toUpperCase()}${text.slice(1)}` : text;
}

function compactHeadline(value) {
  let headline = String(value || "News loading").replace(/\s+/g, " ").trim();
  headline = headline.replace(/^(.+?)\s+to monitor security upgrades after\s+(.+)$/i, "$1 monitors $2");
  const dashParts = headline.split(/\s[-\u2013\u2014]\s/);

  if (dashParts.length > 1) {
    const beforeDash = dashParts[0].trim();
    const afterDash = dashParts.slice(1).join(" - ").trim();
    const startsWithQuote = /^['"\u2018\u201C]/.test(beforeDash);

    if (startsWithQuote && afterDash.length >= 24) {
      return sentenceCase(afterDash);
    }
  }

  return headline;
}

function summaryParagraphs(value) {
  const summary = truncateText(value || "Latest RNZ summary appears here when the feed updates.", 280);
  const sentences = summary.match(/[^.!?]+[.!?]+(?:\s|$)|[^.!?]+$/g)?.map((sentence) => sentence.trim()).filter(Boolean) || [];

  if (sentences.length <= 1) {
    return [summary];
  }

  return [
    sentences[0],
    truncateText(sentences.slice(1).join(" "), 145),
  ].filter(Boolean);
}

function rnzPriorityScore(article) {
  const text = `${article.title || ""} ${article.summary || ""} ${article.link || ""} ${article.feed || ""}`.toLowerCase();
  let score = 0;

  if (/breaking|live updates?|just in|urgent|alert|emergency|evacuat|earthquake|flood|fire|crash|attack|police search|threat/.test(text)) {
    score += 1000;
  }

  if (/technology|tech|science|ai|artificial intelligence|digital|cyber|software|data|privacy|internet|media technology/.test(text)) {
    score += 800;
  }

  if (/politic|parliament|government|minister|coalition|national party|national-led|christopher luxon|luxon|nicola willis|willis|act party|nz first|budget|policy|bill|law/.test(text)) {
    score += 650;
  }

  if (/backlash|criticis|criticized|criticised|under fire|revealed|scrutiny|probe|investigation|inquiry|resign|u-turn|climbdown|backs down|concern|warning|cuts?|cutting|shortfall|fail|scandal|leak|lobbying|conflict/.test(text)) {
    score += 220;
  }

  if (/health|hospital|doctor|nurse|medical|cancer|mental health|pharmac|patient|disease|screening/.test(text)) {
    score += 500;
  }

  return score;
}

function prioritiseRnzArticles(articles) {
  return articles
    .map((article) => ({
      ...article,
      priorityScore: Number(article.priorityScore || 0) + rnzPriorityScore(article),
    }))
    .sort((a, b) => {
      if (b.priorityScore !== a.priorityScore) return b.priorityScore - a.priorityScore;
      return (b.at?.getTime?.() || 0) - (a.at?.getTime?.() || 0);
    })
    .slice(0, rnzMaxArticles)
    .map((article, index) => ({
      ...article,
      rank: index + 1,
    }));
}

function applyLocalLiveData() {
  const live = window.RAINLINE_DATA;
  if (!live || typeof live !== "object") return false;

  data.generatedAt = toDate(live.generatedAt) || data.generatedAt;
  data.nextRefreshAt = toDate(live.nextRefreshAt) || data.nextRefreshAt;
  data.refreshIntervalSeconds = Number(live.refreshIntervalSeconds || data.refreshIntervalSeconds || 600);
  data.nextRetryAt = toDate(live.nextRetryAt) || null;
  data.retryIntervalSeconds = Number(live.retryIntervalSeconds || data.retryIntervalSeconds || 30);
  data.errors = Array.isArray(live.errors) ? live.errors.slice(0, 5) : [];

  if (live.transpower && live.transpower.renewablePercent !== undefined) {
    data.renewables = {
      percent: live.transpower.renewablePercent,
      renewableMw: live.transpower.renewableMw,
      totalMw: live.transpower.totalMw,
      fuels: live.transpower.fuels || {},
      capacityMw: live.transpower.capacityMw || {},
      utilisation: live.transpower.utilisation || {},
      at: toDate(live.transpower.updatedAt || live.generatedAt) || new Date(),
      local: true,
    };

    const load = live.transpower.loadZones;
    data.transpowerLoad = load ? {
      totalMw: load.totalMw,
      updatedAt: toDate(load.updatedAt || live.generatedAt),
      zones: Array.isArray(load.zones) ? load.zones.slice(0, 14).map((zone) => ({
        zone: zone.zone,
        region: zone.region,
        mw: zone.mw,
        mvar: zone.mvar,
        powerFactor: zone.powerFactor,
        updatedAt: toDate(zone.updatedAt || load.updatedAt || live.generatedAt),
      })) : [],
    } : null;
  }

  if (live.rnz?.title || Array.isArray(live.rnz?.articles)) {
    data.newsUpdatedAt = toDate(live.rnz.updatedAt || live.generatedAt) || new Date();
    data.newsArticles = prioritiseRnzArticles((live.rnz.articles || [live.rnz]).map((article, index) => ({
      rank: article.rank || index + 1,
      title: article.title,
      summary: article.summary || "",
      at: toDate(article.publishedAt || live.generatedAt) || new Date(),
      link: article.link,
      feed: article.feed,
      priorityScore: article.priorityScore,
      local: true,
    })).filter((article) => article.title));
  }

  if (live.geonet) {
    data.geonet = {
      updatedAt: toDate(live.geonet.updatedAt || live.generatedAt),
      quakes: (live.geonet.quakes || []).slice(0, 5).map((quake) => ({
        magnitude: quake.magnitude,
        mmi: quake.mmi,
        depthKm: quake.depthKm,
        locality: quake.locality,
        time: toDate(quake.time),
      })),
      volcanoes: (live.geonet.volcanoes || []).slice(0, 5).map((volcano) => ({
        title: volcano.title,
        level: volcano.level,
        colour: volcano.colour,
        activity: volcano.activity,
      })),
      capAlerts: (live.geonet.capAlerts || [])
        .filter((alert) => alert?.title || alert?.summary)
        .slice(0, 3)
        .map((alert) => ({
          title: alert.title,
          summary: alert.summary,
          updatedAt: toDate(alert.updatedAt || live.generatedAt),
          link: alert.link,
        })),
    };
  }

  data.wakaKotahi.roadEvents = live.wakaKotahi?.roadEvents ? {
    updatedAt: toDate(live.wakaKotahi.roadEvents.updatedAt || live.generatedAt),
    events: (live.wakaKotahi.roadEvents.events || []).slice(0, 8).map((event) => ({
      status: event.status,
      type: event.type,
      description: event.description,
      impact: event.impact,
      location: event.location,
      comments: event.comments,
      modifiedAt: toDate(event.modifiedAt),
      startsAt: toDate(event.startsAt),
      endsAt: toDate(event.endsAt),
    })),
  } : null;

  data.wakaKotahi.trafficCounts = live.wakaKotahi?.trafficCounts ? {
    updatedAt: toDate(live.wakaKotahi.trafficCounts.updatedAt || live.generatedAt),
    countDate: toDate(live.wakaKotahi.trafficCounts.countDate),
    region: live.wakaKotahi.trafficCounts.region,
    total: live.wakaKotahi.trafficCounts.total,
    light: live.wakaKotahi.trafficCounts.light,
    heavy: live.wakaKotahi.trafficCounts.heavy,
    sites: (live.wakaKotahi.trafficCounts.sites || []).slice(0, 5),
  } : null;

  data.nemaAlerts = (live.nema?.alerts || [])
    .filter((alert) => alert?.title || alert?.summary)
    .slice(0, 3)
    .map((alert) => ({
      title: alert.title,
      summary: alert.summary,
      publishedAt: toDate(alert.publishedAt || live.generatedAt),
      link: alert.link,
    }));

  return Boolean(data.renewables || data.newsArticles.length || data.geonet || data.wakaKotahi.roadEvents || data.wakaKotahi.trafficCounts);
}

function loadLocalLiveData(sourceIndex = 0) {
  return new Promise((resolve) => {
    const source = localDataSources[sourceIndex];
    if (!source) {
      resolve(applyLocalLiveData());
      return;
    }

    const script = document.createElement("script");
    script.src = `${source}${source.includes("?") ? "&" : "?"}ts=${Date.now()}`;
    script.async = true;
    script.onload = () => {
      if (liveDataScript) liveDataScript.remove();
      liveDataScript = script;
      resolve(applyLocalLiveData());
    };
    script.onerror = () => {
      script.remove();
      resolve(loadLocalLiveData(sourceIndex + 1));
    };
    document.head.appendChild(script);
  });
}

async function fetchTextViaProxy(url) {
  const direct = await fetch(url, { cache: "no-store" }).catch(() => null);
  if (direct && direct.ok) return direct.text();

  const proxied = await fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`, { cache: "no-store" }).catch(() => null);
  if (proxied && proxied.ok) return proxied.text();

  throw new Error(`Unable to fetch ${url}`);
}

async function updateRenewables() {
  try {
    const html = await fetchTextViaProxy("https://www.transpower.co.nz/system-operator/live-system-and-market-data/consolidated-live-data");
    const fuels = {};
    ["Battery", "Co-Gen", "Coal", "Gas", "Geothermal", "Hydro", "Diesel/Oil", "Solar", "Wind"].forEach((fuel) => {
      const escaped = fuel.replace("/", "\\/");
      const match = html.match(new RegExp(`${escaped}\\s+([0-9,.]+)\\s*MW`, "i"));
      fuels[fuel] = match ? Number(match[1].replace(/,/g, "")) : 0;
    });
    const totalMw = Object.values(fuels).reduce((sum, value) => sum + value, 0);
    const renewableMw = fuels.Geothermal + fuels.Hydro + fuels.Solar + fuels.Wind;
    if (totalMw <= 0) throw new Error("No generation values found");
    data.renewables = {
      percent: Math.round((renewableMw / totalMw) * 1000) / 10,
      renewableMw,
      totalMw,
      fuels,
      at: new Date(),
    };
  } catch (error) {
    data.errors.push(error.message);
    data.renewables = {
      percent: "--",
      renewableMw: 0,
      totalMw: 0,
      fuels: {},
      at: new Date(),
      fallback: true,
    };
  }
}

async function updateNews() {
  try {
    const xml = await fetchTextViaProxy("https://www.rnz.co.nz/rss/national.xml");
    const doc = new DOMParser().parseFromString(xml, "application/xml");
    const item = doc.querySelector("item");
    if (!item) throw new Error("No RNZ item found");
    data.newsArticles = prioritiseRnzArticles(Array.from(doc.querySelectorAll("item")).slice(0, 25).map((article, index) => ({
      rank: index + 1,
      title: stripHtml(article.querySelector("title")?.textContent),
      summary: stripHtml(article.querySelector("description")?.textContent).slice(0, 180),
      at: new Date(article.querySelector("pubDate")?.textContent || Date.now()),
      link: article.querySelector("link")?.textContent || "",
    })));
    data.newsUpdatedAt = new Date();
  } catch (error) {
    data.errors.push(error.message);
    data.newsUpdatedAt = new Date();
    data.newsArticles = [{
      rank: 1,
      title: "RNZ feed waiting",
      summary: "Latest headline appears here when the RSS feed is reachable.",
      at: new Date(),
      fallback: true,
    }];
  }
}

function formatFuelUtilisation(fuel, fuels, capacities, utilisation) {
  const current = Number(utilisation[fuel]?.currentMw ?? fuels[fuel] ?? 0);
  const capacity = Number(utilisation[fuel]?.capacityMw ?? capacities[fuel] ?? 0);
  const percent = Number(utilisation[fuel]?.percent);

  if (capacity > 0 && Number.isFinite(percent)) {
    return `${formatCompactMw(current)}/${formatCompactMw(capacity)} ${percent.toFixed(0)}%`;
  }

  return `${current.toLocaleString(undefined, { maximumFractionDigits: 0 })} MW`;
}

function buildGenerationBody(renewables) {
  const fuels = renewables?.fuels || {};
  const utilisation = renewables?.utilisation || {};
  const capacities = renewables?.capacityMw || {};
  const rows = fuelOrder
    .filter((fuel) => Object.prototype.hasOwnProperty.call(fuels, fuel) || Object.prototype.hasOwnProperty.call(utilisation, fuel))
    .map((fuel) => `
      <div class="fuel-row">
        <span>${escapeHtml(fuel)}</span>
        <span>${formatFuelUtilisation(fuel, fuels, capacities, utilisation)}</span>
      </div>
    `)
    .join("");

  return `
    <div class="fuel-total">
      <span>Total ${formatMw(renewables?.totalMw)}</span>
      <span>Renewable ${formatMw(renewables?.renewableMw)}</span>
      <span>Fuel MW / cap / use</span>
    </div>
    <div class="fuel-grid">${rows || "Waiting for generation breakdown."}</div>
  `;
}

function buildLoadBody(load) {
  const zones = (load?.zones || []).slice(0, 6);
  const rows = zones.map((zone) => `
    <div class="data-row">
      <strong>${escapeHtml(zone.region || zone.zone)}</strong>
      <span>${formatCompactMw(zone.mw)}MW PF ${Number(zone.powerFactor || 0).toFixed(2)}</span>
    </div>
  `).join("");

  return `
    <div class="metric-total">NZ demand ${formatMw(load?.totalMw)} by operational zone</div>
    <div class="data-list">${rows || "<p class=\"data-note\">Waiting for Transpower zone load data.</p>"}</div>
    <p class="data-note">Zone feed ${escapeHtml(normaliseDate(load?.updatedAt))}</p>
  `;
}

function buildRnzBody(article) {
  return `
    <article class="news-item solo-news">
      ${summaryParagraphs(article.summary).map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join("")}
    </article>
  `;
}

function buildGeoNetBody(geonet) {
  const capAlerts = geonet?.capAlerts || [];
  const quakes = geonet?.quakes || [];
  const volcanoes = geonet?.volcanoes || [];
  const strongest = quakes.reduce((best, quake) => (
    Number(quake.magnitude || 0) > Number(best?.magnitude || 0) ? quake : best
  ), null);
  const latest = quakes[0];
  const capText = capAlerts.length
    ? `${capAlerts.length} CAP quake alert${capAlerts.length === 1 ? "" : "s"} active.`
    : "No active GeoNet CAP quake alerts.";
  const quakeText = quakes.length
    ? `${quakes.length} recent felt quakes in feed. Strongest M${Number(strongest?.magnitude || 0).toFixed(1)} near ${strongest?.locality || "NZ"}. Latest M${Number(latest?.magnitude || 0).toFixed(1)} ${formatAge(latest?.time)} ago.`
    : "No recent MMI 3+ quakes in the feed.";
  const volcanoText = volcanoes.length
    ? `${volcanoes.length} volcano alert level${volcanoes.length === 1 ? "" : "s"} above zero: ${volcanoes.map((volcano) => `${volcano.title} L${volcano.level}`).join(", ")}.`
    : "No elevated volcano alert levels.";

  return `
    <div class="summary-lines">
      <p>${escapeHtml(quakeText)}</p>
      <p>${escapeHtml(volcanoText)}</p>
      <p>${escapeHtml(capText)}</p>
    </div>
    <p class="data-note">GeoNet ${escapeHtml(normaliseDate(geonet?.updatedAt))}</p>
  `;
}

function buildRoadEventsBody(roadEvents) {
  const rows = (roadEvents?.events || []).slice(0, 3).map((event) => `
    <div class="data-block">
      <strong>${escapeHtml(event.location || event.description || "Road event")}</strong>
      <span>${escapeHtml(truncateText(`${event.impact || event.status || "Event"} - ${event.description || event.type || ""}`, 86))}</span>
    </div>
  `).join("");

  return `
    <div class="data-list road-events">${rows || "<p class=\"data-note\">No active road events returned.</p>"}</div>
    <p class="data-note">Waka Kotahi ${escapeHtml(normaliseDate(roadEvents?.updatedAt))}</p>
  `;
}

function buildTrafficCountsBody(counts) {
  const rows = (counts?.sites || []).slice(0, 4).map((site) => `
    <div class="data-row">
      <strong>${escapeHtml(truncateText(site.description || site.siteRef, 32))}</strong>
      <span>${formatNumber(site.total)} total</span>
    </div>
  `).join("");

  return `
    <div class="metric-total">${escapeHtml(counts?.region || "Region")} daily vehicle movements ${formatNumber(counts?.total)}</div>
    <p class="data-note traffic-explainer">Selected telemetry sites; directions and lanes included.</p>
    <div class="data-row mini">
      <strong>Light ${formatNumber(counts?.light)}</strong>
      <span>Heavy ${formatNumber(counts?.heavy)}</span>
    </div>
    <div class="data-list">${rows || "<p class=\"data-note\">Waiting for traffic count rows.</p>"}</div>
    <p class="data-note">Count date ${escapeHtml(normaliseDate(counts?.countDate))}</p>
  `;
}

function dayOfYear(date) {
  const start = new Date(date.getFullYear(), 0, 0);
  return Math.floor((date - start) / 86400000);
}

function solarTime(date, latitude, longitude, isSunrise) {
  const zenith = 90.833;
  const n = dayOfYear(date);
  const lngHour = longitude / 15;
  const t = n + (((isSunrise ? 6 : 18) - lngHour) / 24);
  const meanAnomaly = (0.9856 * t) - 3.289;
  let trueLong = meanAnomaly + (1.916 * Math.sin(meanAnomaly * Math.PI / 180)) + (0.020 * Math.sin(2 * meanAnomaly * Math.PI / 180)) + 282.634;
  trueLong = (trueLong + 360) % 360;
  let rightAscension = Math.atan(0.91764 * Math.tan(trueLong * Math.PI / 180)) * 180 / Math.PI;
  rightAscension = (rightAscension + 360) % 360;
  rightAscension += (Math.floor(trueLong / 90) * 90) - (Math.floor(rightAscension / 90) * 90);
  rightAscension /= 15;
  const sinDec = 0.39782 * Math.sin(trueLong * Math.PI / 180);
  const cosDec = Math.cos(Math.asin(sinDec));
  const cosHour = (Math.cos(zenith * Math.PI / 180) - (sinDec * Math.sin(latitude * Math.PI / 180))) / (cosDec * Math.cos(latitude * Math.PI / 180));
  if (cosHour > 1 || cosHour < -1) return null;
  let hour = isSunrise ? 360 - Math.acos(cosHour) * 180 / Math.PI : Math.acos(cosHour) * 180 / Math.PI;
  hour /= 15;
  const localMeanTime = hour + rightAscension - (0.06571 * t) - 6.622;
  const utcHour = (localMeanTime - lngHour + 24) % 24;
  const result = new Date(date);
  result.setUTCHours(0, 0, 0, 0);
  result.setUTCMinutes(Math.round(utcHour * 60));
  return result;
}

function moonIllumination(date = new Date()) {
  const knownNewMoon = Date.UTC(2000, 0, 6, 18, 14);
  const phase = (((date.getTime() - knownNewMoon) / 86400000) % 29.53058867 + 29.53058867) % 29.53058867;
  return Math.round((0.5 - 0.5 * Math.cos((2 * Math.PI * phase) / 29.53058867)) * 100);
}

function buildNightCycleBody() {
  const now = new Date();
  const latitude = -40.3523;
  const longitude = 175.6082;
  const sunrise = solarTime(now, latitude, longitude, true);
  const sunset = solarTime(now, latitude, longitude, false);
  const moon = moonIllumination(now);

  return `
    <div class="night-cycle">
      <div><span>SUNRISE</span><strong>${escapeHtml(normaliseDate(sunrise))}</strong></div>
      <div><span>SUNSET</span><strong>${escapeHtml(normaliseDate(sunset))}</strong></div>
      <div><span>MOON</span><strong>${moon}%</strong></div>
    </div>
    <p class="data-note">LOWER NORTH ISLAND NIGHT CYCLE</p>
  `;
}

function buildInfrastructureBody() {
  const seed = Math.floor(Date.now() / 600000);
  const luminance = 88 + (seed % 9);
  const skybridge = 55 + ((seed * 7) % 30);
  const district = 72 + ((seed * 11) % 22);

  return `
    <div class="data-list">
      <div class="data-row system-row"><strong>Luminance grid</strong><span>${luminance}% ${inlineMeter(luminance)}</span></div>
      <div class="data-row system-row"><strong>Skybridge flow</strong><span>${skybridge}% ${inlineMeter(skybridge)}</span></div>
      <div class="data-row system-row"><strong>Lower district signal</strong><span>${district}% ${inlineMeter(district)}</span></div>
    </div>
    <p class="data-note">MUNICIPAL GHOST LAYER // NOMINAL</p>
  `;
}

function buildCityAdBody(lines, tone = "cyan") {
  return `
    <div class="city-ad-data ${escapeHtml(tone)}">
      ${lines.map((line, index) => `<p class="${index === 0 ? "major" : ""}">${escapeHtml(line)}</p>`).join("")}
      <div class="city-ad-scan"><i></i></div>
    </div>
  `;
}

function buildTeslaEnergyBody() {
  const percent = Number(data.renewables?.percent || 0);
  const renewableLine = percent >= 80
    ? `RENEWABLES ${percent.toFixed(0)}% // STORAGE READY`
    : `RENEWABLE SHORTFALL // ADDING MORE`;

  return buildCityAdBody([
    "GRID LOAD LOW",
    renewableLine,
    "CHARGE WINDOW OPEN",
  ], "green");
}

function buildNemaBody(alerts) {
  const rows = alerts.map((alert) => `
    <div class="data-block urgent">
      <strong>${escapeHtml(truncateText(alert.title || "Emergency alert", 62))}</strong>
      <span>${escapeHtml(truncateText(alert.summary, 112))}</span>
    </div>
  `).join("");

  return rows || "<p class=\"data-note\">No current NEMA alerts.</p>";
}

function feedIssue() {
  const errors = data.errors || [];
  const errorText = errors.join(" | ");
  const target = nextRefreshDate();
  const generatedAt = data.generatedAt?.getTime?.() || 0;
  const refreshMs = Math.max(60000, Number(data.refreshIntervalSeconds || 600) * 1000);
  const isStale = Boolean(generatedAt && (
    (target && Date.now() > target.getTime() + refreshGraceMs) ||
    Date.now() > generatedAt + refreshMs + refreshGraceMs
  ));
  const coreFeedsFailed = /Transpower:/i.test(errorText) && /RNZ:/i.test(errorText);
  const manyFeedsFailed = errors.length >= 3;
  const noCoreData = !data.renewables && data.newsArticles.length === 0;

  if (!forcedIssue && !isStale && !coreFeedsFailed && !manyFeedsFailed && !noCoreData) {
    return { active: false };
  }

  const problemLines = [];
  if (forcedIssue) problemLines.push("Forced city issue preview.");
  if (isStale) problemLines.push("Live data missed its refresh window.");
  if (coreFeedsFailed || manyFeedsFailed) problemLines.push("Network feeds failed during the last update attempt.");
  if (noCoreData) problemLines.push("No cached core grid or RNZ data is available.");
  if (errors.length) problemLines.push(`Feed errors: ${errors.slice(0, 3).map((error) => error.split(":")[0]).join(", ")}.`);

  return {
    active: true,
    key: [
      forcedIssue ? "forced" : "",
      isStale ? "stale" : "",
      coreFeedsFailed ? "core" : "",
      manyFeedsFailed ? `errors-${errors.length}` : "",
      generatedAt,
    ].join(":"),
    source: isStale ? "CITY SIGNAL" : "CITY ISSUE",
    title: isStale ? "NO FRESH DATA" : "FEED LINK DEGRADED",
    lines: problemLines.length ? problemLines : ["Live feeds are not updating correctly."],
  };
}

function buildIssueSlide(issue) {
  return {
    kind: "issue",
    source: issue.source,
    title: issue.title,
    bodyHtml: `
      <div class="issue-slide">
        ${issue.lines.slice(0, 4).map((line) => `<p>${escapeHtml(line)}</p>`).join("")}
      </div>
    `,
    timeHtml: `
      <span class="danger-label">NEXT RELINK ATTEMPT</span>
      <span class="danger-countdown">${escapeHtml(formatCountdown(nextReconnectDate()).toUpperCase())}</span>
    `,
  };
}

function nextRefreshDate() {
  if (data.nextRefreshAt) return data.nextRefreshAt;
  if (data.generatedAt && data.refreshIntervalSeconds) {
    return new Date(data.generatedAt.getTime() + data.refreshIntervalSeconds * 1000);
  }
  return null;
}

function nextReconnectDate() {
  if (data.nextRetryAt && data.nextRetryAt.getTime() > Date.now()) {
    return data.nextRetryAt;
  }

  if (nextLocalPollAt && nextLocalPollAt > Date.now()) {
    return new Date(nextLocalPollAt);
  }

  const retrySeconds = Math.max(5, Number(data.retryIntervalSeconds || 30));
  return new Date(Date.now() + retrySeconds * 1000);
}

function formatCountdown(target) {
  if (!target) return "waiting";
  const diffMs = target.getTime() - Date.now();
  if (diffMs <= -15000) return "refresh due";
  if (diffMs <= 0) return "due now";
  const totalSeconds = Math.ceil(diffMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    return `${hours}h ${minutes % 60}m`;
  }
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function buildTickerText(content) {
  if (content.kind === "issue") {
    const relink = formatCountdown(nextReconnectDate()).toUpperCase();
    return `SIGNAL DEGRADED // CITY LINK RETRY IN ${relink} // CACHE HOLDING // RAINLINE CITY NETWORK // PUBLIC DATA STREAM // RECONNECTING`;
  }

  const gridStatus = data.renewables ? "GRID OK" : "GRID WAIT";
  const rnzStatus = data.newsArticles.length ? "RNZ FEED OK" : "RNZ WAIT";
  const geoStatus = data.geonet ? "GEONET LIVE" : "GEONET WAIT";
  const roadStatus = data.wakaKotahi.roadEvents ? "ROAD DATA LIVE" : "ROAD DATA WAIT";
  const next = formatCountdown(nextRefreshDate()).toUpperCase();
  const slide = `${content.source || "RAINLINE"} ${content.title || ""}`.trim();
  return `${gridStatus} // ${rnzStatus} // ${geoStatus} // ${roadStatus} // ${slide} // NEXT SYNC ${next} // RAINLINE CITY NETWORK // PUBLIC DATA STREAM // SIGNAL STABLE`;
}

function heartbeatForSlide(content) {
  const source = `${content.source || ""} ${content.title || ""}`.toLowerCase();
  if (source.includes("issue") || source.includes("no fresh")) {
    return { label: "SIGNAL LOSS", value: 2 };
  }
  if (source.includes("traffic")) {
    const count = Number(data.wakaKotahi.trafficCounts?.total || 0);
    return { label: "ROAD FLOW", value: Math.min(10, Math.max(2, count / 10000)) };
  }
  if (source.includes("waka")) {
    const events = data.wakaKotahi.roadEvents?.events?.length || 0;
    return { label: "ROAD FLOW", value: Math.min(10, 4 + events) };
  }
  if (source.includes("geonet")) {
    const quakes = data.geonet?.quakes?.length || 0;
    const volcanoes = data.geonet?.volcanoes?.length || 0;
    return { label: "SEISMIC NOISE", value: Math.min(10, 1 + quakes + volcanoes) };
  }
  if (source.includes("night")) {
    return { label: "NIGHT CYCLE", value: Math.max(2, moonIllumination() / 10) };
  }
  if (source.includes("infrastructure")) {
    return { label: "CITY HEART", value: 8 };
  }
  if (source.includes("rnz")) {
    return { label: "FEED SIGNAL", value: data.newsArticles.length ? 8 : 2 };
  }
  if (source.includes("transpower") || source.includes("grid")) {
    const percent = Number(data.renewables?.percent || 0);
    return { label: "GRID PULSE", value: percent ? percent / 10 : 5 };
  }
  return { label: "CITY PULSE", value: 7 };
}

function sponsorForSlide(content) {
  return deterministicChoice(sponsors, `${content.source}|${content.title}|${data.generatedAt?.getTime?.() || ""}`);
}

function startHeartbeat(heartbeat, durationMs) {
  currentHeartbeat = {
    label: heartbeat.label,
    target: Math.max(0, Math.min(10, Number(heartbeat.value || 0))),
    startedAt: Date.now(),
    durationMs: Math.max(1200, Number(durationMs || defaultSlideDurationMs)),
  };

  updateHeartbeat();
}

function updateHeartbeat() {
  if (!currentHeartbeat) return;

  const progress = Math.min(1, Math.max(0, (Date.now() - currentHeartbeat.startedAt) / currentHeartbeat.durationMs));
  const value = currentHeartbeat.target * progress;

  if (sign.heartbeatLabel) {
    sign.heartbeatLabel.textContent = currentHeartbeat.label;
  }

  if (sign.heartbeatFill) {
    sign.heartbeatFill.style.width = `${Math.max(3, value * 10)}%`;
  }

  if (sign.heartbeatBars) {
    sign.heartbeatBars.textContent = asciiBars(value);
  }
}

function paidAdViewportSize(min, ratio, max) {
  return clampNumber(window.innerWidth * ratio, min, max);
}

function setPaidAdBaseSizes(ad) {
  const tagLength = String(ad.tag || "").length;
  const nameLength = String(ad.name || "").length;
  const copyLength = String(ad.copy || "").length;

  let tagSize = paidAdViewportSize(5, 0.0045, 9);
  let nameSize = paidAdViewportSize(7, 0.0068, 13);
  let copySize = paidAdViewportSize(6, 0.0062, 12);

  if (tagLength > 22) tagSize *= 0.84;
  else if (tagLength > 15) tagSize *= 0.92;

  if (nameLength > 12) nameSize *= 0.9;
  if (copyLength > 34) copySize *= 0.76;
  else if (copyLength > 25) copySize *= 0.88;

  paidAd.slot.style.setProperty("--paid-ad-tag-size", `${clampNumber(tagSize, 4, 9).toFixed(1)}px`);
  paidAd.slot.style.setProperty("--paid-ad-name-size", `${clampNumber(nameSize, 5.5, 13).toFixed(1)}px`);
  paidAd.slot.style.setProperty("--paid-ad-copy-size", `${clampNumber(copySize, 4.2, 12).toFixed(1)}px`);
  paidAd.slot.style.setProperty("--paid-ad-logo-scale", copyLength > 30 || tagLength > 20 ? "62%" : "70%");
}

function shrinkPaidAdText(element, propertyName, minSize) {
  if (!element) return;

  let size = Number.parseFloat(getComputedStyle(element).fontSize);
  let attempts = 0;

  while (
    attempts < 16 &&
    size > minSize &&
    (element.scrollWidth > element.clientWidth + 1 || element.scrollHeight > element.clientHeight + 1)
  ) {
    size -= 0.5;
    paidAd.slot.style.setProperty(propertyName, `${Math.max(minSize, size).toFixed(1)}px`);
    attempts += 1;
  }
}

function fitPaidAdText() {
  if (!paidAd.slot || !paidAd.frame) return;

  shrinkPaidAdText(paidAd.tag, "--paid-ad-tag-size", 4);
  shrinkPaidAdText(paidAd.name, "--paid-ad-name-size", 5.5);
  shrinkPaidAdText(paidAd.copy, "--paid-ad-copy-size", 4.2);
}

function setPaidAd(ad) {
  if (!paidAd.slot || !paidAd.frame) return;

  currentPaidAd = ad;
  setPaidAdBaseSizes(ad);
  paidAd.tag.textContent = ad.tag;
  paidAd.logo.innerHTML = ad.logoHtml;
  paidAd.name.textContent = ad.name;
  paidAd.copy.textContent = ad.copy;
  paidAd.slot.style.setProperty("--ad-primary", ad.primary);
  paidAd.slot.style.setProperty("--ad-secondary", ad.secondary);
  paidAd.slot.style.setProperty("--ad-primary-soft", ad.primarySoft);
  paidAd.slot.style.setProperty("--ad-secondary-soft", ad.secondarySoft);

  requestAnimationFrame(() => requestAnimationFrame(fitPaidAdText));
}

function choosePaidAd() {
  if (forcedAd) {
    const target = forcedAd.toLowerCase();
    return paidAds.find((ad) => `${ad.tag} ${ad.name} ${ad.copy}`.toLowerCase().includes(target)) || paidAds[0];
  }

  return randomChoice(paidAds);
}

function showPaidAd() {
  if (!paidAd.slot) return;

  setPaidAd(choosePaidAd());
  paidAd.slot.classList.remove("is-active");
  paidAd.slot.getBoundingClientRect();
  paidAd.slot.classList.add("is-active");
  setTimeout(() => {
    paidAd.slot.classList.remove("is-active");
  }, 6000);
}

function schedulePaidAds() {
  setTimeout(() => {
    showPaidAd();
    schedulePaidAds();
  }, randomBetween(6500, 18000));
}

function buildRefreshFooterHtml() {
  const target = nextRefreshDate();
  return `
    <span>${escapeHtml(formatSignalAge())}</span>
    <span>NEXT SYNC ${escapeHtml(formatCountdown(target))}</span>
  `;
}

function clearTransitionTimers() {
  transitionTimers.forEach((timer) => clearTimeout(timer));
  transitionTimers = [];
}

function setSlideContent(content) {
  if (sign.shell) {
    sign.shell.classList.toggle("signal-lost", content.kind === "issue");
  }

  sign.source.textContent = content.source;
  sign.title.textContent = content.title;
  const heartbeat = heartbeatForSlide(content);
  if (sign.sponsor) sign.sponsor.textContent = sponsorForSlide(content);
  startHeartbeat(heartbeat, content.durationMs || defaultSlideDurationMs);
  sign.body.innerHTML = content.bodyHtml;
  if (sign.ticker) sign.ticker.textContent = `${buildTickerText(content)} // ${buildTickerText(content)}`;
  sign.time.innerHTML = content.timeHtml || buildRefreshFooterHtml();
}

function updateFooter() {
  sign.time.innerHTML = buildRefreshFooterHtml();
  updateHeartbeat();
}

function showGlitchTransition() {
  if (!sign.transition) return;

  const ad = randomChoice(transitionAds);
  const effect = randomChoice(transitionClasses);
  sign.transitionKicker.textContent = ad.kicker;
  sign.transitionTitle.textContent = ad.title;
  sign.transitionCopy.textContent = ad.copy;
  sign.transition.className = `glitch-transition is-active ${effect}`;
}

function hideGlitchTransition() {
  if (!sign.transition) return;
  sign.transition.className = "glitch-transition";
}

function setSlide(content, withTransition = false) {
  clearTransitionTimers();

  if (!withTransition) {
    hideGlitchTransition();
    setSlideContent(content);
    return;
  }

  showGlitchTransition();
  if (sign.shell) sign.shell.classList.add("micro-glitch");
  const previousSource = sign.source.textContent;
  const previousTitle = sign.title.textContent;
  sign.source.textContent = glitchText(previousSource);
  sign.title.textContent = glitchText(previousTitle);
  transitionTimers.push(setTimeout(() => setSlideContent(content), 110));
  transitionTimers.push(setTimeout(() => {
    if (sign.shell) sign.shell.classList.remove("micro-glitch");
  }, 260));
  transitionTimers.push(setTimeout(hideGlitchTransition, 420));
}

function buildExtraSlides(timeHtml) {
  const extras = [];

  if (data.transpowerLoad) {
    extras.push({
      source: "TRANSPOWER LOAD",
      title: `${formatMw(data.transpowerLoad.totalMw)} demand`,
      bodyHtml: buildLoadBody(data.transpowerLoad),
      timeHtml,
    });
  }

  if (data.geonet) {
    const capCount = data.geonet.capAlerts?.length || 0;
    extras.push({
      source: capCount ? "GEONET CAP ALERT" : "GEONET",
      title: capCount ? "Quake alert active" : "GEONET DATA",
      bodyHtml: buildGeoNetBody(data.geonet),
      timeHtml,
    });
  }

  if (data.wakaKotahi.roadEvents) {
    extras.push({
      source: "WAKA KOTAHI",
      title: "Road events",
      bodyHtml: buildRoadEventsBody(data.wakaKotahi.roadEvents),
      timeHtml,
    });
  }

  if (data.wakaKotahi.trafficCounts) {
    extras.push({
      source: "WAKA KOTAHI",
      title: "Traffic counts",
      bodyHtml: buildTrafficCountsBody(data.wakaKotahi.trafficCounts),
      timeHtml,
    });
  }

  extras.push({
    source: "TOYOTA",
    title: "Hybrid drive system online",
    bodyHtml: buildCityAdBody([
      "HYBRID DRIVE SYSTEM ONLINE",
      "CITY RANGE OPTIMISED",
      "REGEN LOOP // NIGHT MODE",
    ], "red"),
    timeHtml,
  });

  extras.push({
    source: "SPOTIFY",
    title: "City Music Feed",
    bodyHtml: buildCityAdBody([
      "MOOD DETECTED",
      "PLAYLIST: NEON MELANCHOLY",
      "RAIN BPM // LOW HEART RATE",
    ], "green"),
    timeHtml,
  });

  extras.push({
    source: "GOOGLE",
    title: "City indexing complete",
    bodyHtml: buildCityAdBody([
      "CITY INDEXING COMPLETE",
      "12,804,231 SIGNALS FOUND",
      "PRIVACY STATUS: DECORATIVE",
    ], "blue"),
    timeHtml,
  });

  extras.push({
    source: "TESLA ENERGY",
    title: "Charge window open",
    bodyHtml: buildTeslaEnergyBody(),
    timeHtml,
  });

  extras.push({
    source: "MICROSOFT AZURE",
    title: "City cloud stable",
    bodyHtml: buildCityAdBody([
      "CITY CLOUD STABLE",
      "UPTIME 99.998%",
      "DISTRICT FAILOVER ARMED",
    ], "blue"),
    timeHtml,
  });

  extras.push({
    source: "NIGHT CYCLE",
    title: "Moon + sun",
    bodyHtml: buildNightCycleBody(),
    timeHtml,
  });

  extras.push({
    source: "CITY INFRASTRUCTURE",
    title: "Deep City System",
    bodyHtml: buildInfrastructureBody(),
    timeHtml,
  });

  if (data.nemaAlerts.length) {
    extras.unshift({
      source: "NEMA ALERT",
      title: "Emergency alert",
      bodyHtml: buildNemaBody(data.nemaAlerts),
      timeHtml,
    });
  }

  return extras;
}

function buildRareEventSlide(timeHtml) {
  const event = randomChoice(rareEvents);
  return {
    source: event.source,
    title: event.title,
    bodyHtml: `
      <div class="rare-slide">
        <p>${escapeHtml(event.copy)}</p>
      </div>
    `,
    timeHtml,
  };
}

function buildBaseSlides() {
  const renewables = data.renewables;
  const articles = data.newsArticles.length
    ? data.newsArticles
    : [{ rank: 1, title: "News loading", summary: "Waiting for latest headline.", at: new Date() }];
  const timeHtml = buildRefreshFooterHtml();
  const generationSlide = {
    source: renewables?.fallback ? "GRID DATA WAITING" : "TRANSPOWER GENERATION",
    title: renewables ? `${renewables.percent}% renewable` : "--% renewable",
    bodyHtml: buildGenerationBody(renewables),
    timeHtml,
    durationMs: generationSlideDurationMs,
  };
  const rnzSlides = articles.map((article) => ({
    source: article.fallback ? "RNZ BUFFERING" : `RNZ ${article.rank}/${articles.length}`,
    title: truncateText(compactHeadline(article.title), 96),
    bodyHtml: buildRnzBody(article),
    timeHtml,
  }));
  const dataSlides = [generationSlide, ...buildExtraSlides(timeHtml)];
  const arranged = [];

  if (!rnzSlides.length) {
    return dataSlides;
  }

  const pairCount = Math.max(dataSlides.length, rnzSlides.length);
  for (let index = 0; index < pairCount; index += 1) {
    if (dataSlides[index]) arranged.push(dataSlides[index]);
    arranged.push(rnzSlides[index % rnzSlides.length]);
  }

  return arranged;
}

function getDataStamp() {
  return [
    data.generatedAt?.getTime?.() || 0,
    data.renewables?.at?.getTime?.() || 0,
    data.newsArticles.map((article) => article.link || article.title).join("|"),
    data.nemaAlerts.length,
  ].join("::");
}

function createRotationPlan() {
  const planSlides = buildBaseSlides();
  const stamp = getDataStamp();
  const forceRare = forcedSlide && /rare|easter|nice|catch|city ai|calibration/i.test(forcedSlide);

  if ((forceRare || Math.random() < rareEventChance) && planSlides.length > 2) {
    const insertAt = forceRare ? 0 : 1 + Math.floor(Math.random() * (planSlides.length - 1));
    planSlides.splice(insertAt, 0, buildRareEventSlide(buildRefreshFooterHtml()));
  }

  const totalDurationMs = planSlides.reduce((sum, slide) => sum + (slide.durationMs || defaultSlideDurationMs), 0);
  const startedAt = Date.now();
  rotationPlan = {
    dataStamp: stamp,
    expiresAt: startedAt + totalDurationMs,
    id: `${startedAt}:${Math.random().toString(36).slice(2)}`,
    slides: planSlides,
    startedAt,
    totalDurationMs,
  };

  return rotationPlan;
}

function getRotationPlan() {
  const stamp = getDataStamp();
  if (!rotationPlan || rotationPlan.dataStamp !== stamp || Date.now() >= rotationPlan.expiresAt) {
    return createRotationPlan();
  }

  return rotationPlan;
}

function renderSlide() {
  const issue = feedIssue();
  if (issue.active && !forcedSlide) {
    const issueSlide = buildIssueSlide(issue);
    const issueKey = `issue:${issue.key}:${issue.title}`;
    if (issueKey !== currentRenderedKey) {
      setSlide(issueSlide, currentRenderedKey !== "");
      currentRenderedKey = issueKey;
    } else {
      sign.time.innerHTML = issueSlide.timeHtml;
      if (sign.ticker) sign.ticker.textContent = `${buildTickerText(issueSlide)} // ${buildTickerText(issueSlide)}`;
      updateHeartbeat();
    }
    return;
  }

  const plan = getRotationPlan();
  const availableSlides = plan.slides;
  let elapsedMs = (Date.now() - plan.startedAt) % plan.totalDurationMs;
  let slideIndex = 0;

  for (let index = 0; index < availableSlides.length; index += 1) {
    elapsedMs -= availableSlides[index].durationMs || defaultSlideDurationMs;
    if (elapsedMs < 0) {
      slideIndex = index;
      break;
    }
  }

  if (forcedSlide) {
    const numericIndex = Number(forcedSlide);
    slideIndex = Number.isFinite(numericIndex)
      ? numericIndex
      : availableSlides.findIndex((slide) => `${slide.source} ${slide.title}`.toLowerCase().includes(forcedSlide.toLowerCase()));
    if (slideIndex < 0) slideIndex = 0;
    slideIndex %= availableSlides.length;
  }

  const slideKey = `${plan.id}:${slideIndex}:${availableSlides[slideIndex].source}:${availableSlides[slideIndex].title}`;
  if (slideKey !== currentRenderedKey) {
    setSlide(availableSlides[slideIndex], currentRenderedKey !== "");
    currentRenderedKey = slideKey;
  } else {
    updateFooter();
  }
}

async function refreshData() {
  try {
    const hasLocalData = await loadLocalLiveData();
    if (!hasLocalData) {
      await Promise.allSettled([updateRenewables(), updateNews()]);
    }
  } catch (error) {
    data.errors.unshift(`Wallpaper refresh: ${error.message}`);
  } finally {
    nextLocalPollAt = Date.now() + 30 * 1000;
    renderSlide();
  }
}

video.play().catch(() => {
  video.controls = false;
});

window.addEventListener("rainline-data-updated", () => {
  applyLocalLiveData();
  renderSlide();
});

applyLocalLiveData();
renderSlide();
refreshData();
setTimeout(() => {
  showPaidAd();
  schedulePaidAds();
}, 2800);
setInterval(refreshData, 30 * 1000);
setInterval(renderSlide, 1000);
window.addEventListener("resize", () => {
  if (!currentPaidAd) return;
  setPaidAdBaseSizes(currentPaidAd);
  requestAnimationFrame(fitPaidAdText);
});
