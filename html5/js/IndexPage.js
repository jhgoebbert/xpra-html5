const default_settings = {};
const getparam = function (prop) {
  let v = Utilities.getparam(prop);
  if (v == null && prop in default_settings) {
    v = default_settings[prop];
  }
  return v;
};

const getboolparam = function (prop, default_value) {
  let v = Utilities.getparam(prop);
  if (v == null && prop in default_settings) {
    v = default_settings[prop];
  }
  return Utilities.stristrue(v, default_value);
};
const getboolautoparam = function (prop, default_value) {
  let v = Utilities.getparam(prop);
  if (v == null && prop in default_settings) {
    v = default_settings[prop];
  }
  if (v == "auto") {
    return "auto";
  }
  return Utilities.stristrue(v, default_value);
};
const getintparam = function (prop, default_value) {
  let v = Utilities.getparam(prop);
  if (v == null && prop in default_settings) {
    v = default_settings[prop];
  }
  try {
    v = parseInt(v);
  } catch {
    return default_value;
  }
  if (v === null || isNaN(v)) {
    return default_value;
  }
  return v;
};
const getfloatparam = function (prop, default_value) {
  let v = Utilities.getparam(prop);
  if (v == null && prop in default_settings) {
    v = default_settings[prop];
  }
  try {
    v = parseFloat(v);
  } catch {
    return default_value;
  }
  if (v === null || isNaN(v)) {
    return default_value;
  }
  return v;
};

const float_menu_item_size = 30;
const float_menu_padding = 20;
let float_menu_width = float_menu_item_size * 5 + float_menu_padding;

let cdebug = function () {
  Utilities.clog.apply(Utilities, arguments);
};
let clog = function () {
  Utilities.clog.apply(Utilities, arguments);
};

//start calculating the fps asap:
let animation_times = [];
let fps = -1;
let vrefresh = -1;
function animation_cb(now) {
  let l = animation_times.push(now);
  if (l > 100) {
    animation_times.shift();
  }
  let t0 = animation_times[0];
  if (now > t0) {
    fps = Math.floor((1000 * (l - 1)) / (now - t0));
  }
  cdebug("draw", "animation_cb", now, "fps", fps, "vrefresh", vrefresh);
  if (vrefresh < 0) {
    window.requestAnimationFrame(animation_cb);
  }
}
window.requestAnimationFrame(animation_cb);

function confirm_shutdown_server() {
  if (confirm("Shutdown this server?")) {
    client.reconnect = false;
    client.send(["shutdown-server"]);
  }
}

function upload_file(event) {
  $(".menu-content").slideUp();
  $("#upload").click();
}

function cleanup_dialogs() {
  $(".menu-content").slideUp();
  $("#about").hide();
  hide_sessioninfo();
  hide_bugreport();
}
function connection_established() {
  //this may be a re-connection,
  //so make sure we cleanup any left-overs
  clog("connection-established");
  cleanup_dialogs();
  $("button.menu-button").prop("disabled", false);
}
function connection_lost() {
  clog("connection-lost");
  cleanup_dialogs();
  $("button.menu-button").prop("disabled", true);
}
document.addEventListener("connection-established", connection_established);
document.addEventListener("connection-lost", connection_lost);

$("body").click(function () {
  $(".menu-content").slideUp();
  $("#about").hide();
  hide_sessioninfo();
});

function enable_clipboard_autofocus() {
  $("#pasteboard").blur(function () {
    //force focus back to our capture widget:
    if (client.capture_keyboard) {
      $("#pasteboard").focus();
    }
  });
  const pasteboard_element = $("#pasteboard");
  pasteboard_element.prop("autofocus");
  pasteboard_element.focus();
}
function cancel_clipboard_autofocus() {
  $("#pasteboard").removeAttr("autofocus");
}

function show_about(event) {
  $(".menu-content").slideUp();
  $("#about").show();
  hide_sessioninfo();
  event.stopPropagation();
}

//session-info handling:
function show_sessioninfo(event) {
  $(".menu-content").slideUp();
  $("#about").hide();
  $("#sessiondata td").html("");
  $("#sessioninfo").show();
  client.start_info_timer();
  event.stopPropagation();
}
function hide_sessioninfo() {
  $("#sessioninfo").hide();
  client.stop_info_timer();
}
document.addEventListener(
  "info-response",
  function (e) {
    const info = e.data;
    $("#endpoint").html(client.uri);
    $("#server_display").html(client.server_display);
    $("#server_platform").html(client.server_platform);
    if (client.server_load == null) {
      $("#server_load").html("n/a");
    } else {
      $("#server_load").html(`${client.server_load}`);
    }
    function toHHMMSS(t) {
      let s = "";
      const hh = Math.floor(t / 1000 / 60 / 60);
      if (hh > 0) s += `${hh}:`;
      const mm = Math.floor(t / 1000 / 60) % 60;
      s += `0${mm}`.slice(-2); //left pad with "0"
      const ss = Math.floor(t / 1000) % 60;
      s += `:${`0${ss}`.slice(-2)}`; //left pad with "0"
      return s;
    }
    const elapsed = Date.now() - client.client_start_time;
    $("#session_connected").html(toHHMMSS(elapsed));
    if (client.server_ping_latency >= 0)
      $("#server_latency").html(client.server_ping_latency);
    if (client.client_ping_latency >= 0)
      $("#client_latency").html(client.client_ping_latency);
    //TODO:
    // * add packet counter to Protocol.js
    //"Packets Received"
    //"Encoding + Compression"
  },
  false
);

function enable_bugreport_submit() {
  $("#bugreport_submit").prop("disabled", false);
  document.removeEventListener("info-response", enable_bugreport_submit);
}
function hide_bugreport() {
  $("#bugreport").hide();
  enable_clipboard_autofocus();
}
function show_bugreport(event) {
  //stop capturing input, so we can interact with the bugreport form:
  client.capture_keyboard = false;
  cancel_clipboard_autofocus();
  //hide menu:
  $(".menu-content").slideUp();
  $("#bugreport").show();
  event.stopPropagation();
  //disable submit until we get an info-response:
  $("#bugreport_submit").prop("disabled", true);
  document.addEventListener("info-response", enable_bugreport_submit);
  client.send_info_request();
}
function generate_bugreport() {
  client.capture_keyboard = true;
  const zip = new JSZip();
  zip.file(
    "Summary.txt",
    `${$("#bugreport_summary").val()}\n\n${$("#bugreport_description").val()}`
  );
  zip.file("Server-Info.txt", `${JSON.stringify(client.server_last_info)}`);
  //screenshot:
  const canvas = document.createElement("canvas");
  canvas.width = client.desktop_width;
  canvas.height = client.desktop_height;
  const ctx = canvas.getContext("2d");
  for (let i in client.id_to_window) {
    const iwin = client.id_to_window[i];
    ctx.drawImage(iwin.draw_canvas, iwin.x, iwin.y);
  }
  const png_base64 = canvas.toDataURL("image/png");
  zip.file("screenshot.png", Utilities.convertDataURIToBinary(png_base64));
  zip.generateAsync({ type: "blob" }).then(function (content) {
    saveAs(content, "bugreport.zip");
  });
  hide_bugreport();
}
const password_input = document.querySelector("#password");
let login_callback = null;
function login_cancel() {
  $("#login-overlay").fadeOut();
  password_input.removeEventListener("keydown", password_special_keys);
  password_input.value = "";
  login_callback(null);
}
function login_connect() {
  $("#login-overlay").fadeOut();
  const password = password_input.value;
  password_input.removeEventListener("keydown", password_special_keys);
  password_input.value = "";
  login_callback(password);
}
function password_special_keys(e) {
  if (!e) {
    e = window.event;
  }
  if (e.keyCode == 13) {
    e.preventDefault();
    login_connect();
  }
  if (e.keyCode == 27) {
    e.preventDefault();
    login_cancel();
  }
}
function password_prompt_fn(heading, callback) {
  login_callback = callback;
  $("#login-overlay").fadeIn();
  $("#login-header").text(heading);
  password_input.focus();
  password_input.addEventListener("keydown", password_special_keys);
}

function keycloak_prompt_fn(url, callback) {
  const params = new URLSearchParams(window.location.search);
  const code = params.get("code");
  const error = params.get("error");
  if (error) {
    const error_description = params.get("error_description");
    callback(JSON.stringify({ error, error_description }));
  } else if (!code) {
    window.location.href = url;
  } else {
    history.replaceState({}, "", window.location.pathname);
    callback(JSON.stringify({ code }));
  }
}

let touchaction_scroll = true;
function toggle_touchaction() {
  touchaction_scroll = !touchaction_scroll;
  set_touchaction();
}
function set_touchaction() {
  let touchaction;
  let label;
  if (touchaction_scroll) {
    touchaction = "none";
    label = "zoom";
  } else {
    touchaction = "auto";
    label = "scroll";
  }
  cdebug(
    "mouse",
    "set_touchaction() touchaction=",
    touchaction,
    "label=",
    label
  );
  $("div.window canvas").css("touch-action", touchaction);
  $("#touchaction_link").html(`Set Touch Action: ${label}`);
  if (!Utilities.isEdge()) {
    $("#touchaction_link").hide();
  }
}

function init_client() {
  if (typeof jQuery == "undefined") {
    window.alert(
      "Incomplete Xpra HTML5 client installation: jQuery is missing, cannot continue."
    );
    return;
  }
  const https = document.location.protocol == "https:";

  // look at url parameters
  const username = getparam("username") || getparam("handle") || null;
  const passwords = [];
  for (let i = 0; i < 10; i++) {
    let password = getparam(`password${i}`) || getparam(`token${i}`) || null;
    if (!password && i == 0) {
      //try with no suffix:
      password = getparam("password") || getparam("token") || null;
    }
    if (password) {
      passwords.push(password);
    } else {
      break;
    }
  }
  const sound = getboolparam("sound", true) || null;
  const audio_codec = getparam("audio_codec") || null;
  const offscreen = getboolparam("offscreen", true);
  const encoding = getparam("encoding") || null;
  const bandwidth_limit = getintparam("bandwidth_limit", 0) || 0;
  const action = getparam("action") || "connect";
  const display = getparam("display") || "";
  const shadow_display = getparam("shadow_display") || "";
  const submit = getboolparam("submit", true);
  const server = getparam("server") || window.location.hostname;
  const port = getparam("port") || window.location.port;
  const ssl = getboolparam("ssl", https);
  const path = getparam("path") || window.location.pathname;
  const encryption = getparam("encryption") || null;
  const key = getparam("key") || null;
  const keyboard_layout = getparam("keyboard_layout") || null;
  const start = getparam("start");
  const exit_with_children = getboolparam("exit_with_children", false);
  const exit_with_client = getboolparam("exit_with_client", false);
  const sharing = getboolparam("sharing", false);
  const video = getboolparam("video", Utilities.is_64bit());
  const mediasource_video = getboolparam("mediasource_video", false);
  const remote_logging = getboolparam("remote_logging", true);
  const insecure = getboolparam("insecure", false);
  const ignore_audio_blacklist = getboolparam("ignore_audio_blacklist", false);
  const keyboard = getboolparam("keyboard", Utilities.isMobile());
  const clipboard = getboolparam("clipboard", true);
  const printing = getboolparam("printing", true);
  const file_transfer = getboolparam("file_transfer", true);
  const steal = getboolparam("steal", true);
  const reconnect = getboolparam("reconnect", true);
  const swap_keys = getboolparam("swap_keys", Utilities.isMacOS());
  const scroll_reverse_x = getboolparam("scroll_reverse_x", false);
  const scroll_reverse_y = getboolautoparam("scroll_reverse_y", null);
  const floating_menu = getboolparam("floating_menu", true);
  const toolbar_position = getparam("toolbar_position");
  const autohide = getboolparam("autohide", false);
  const override_width = getfloatparam("override_width", window.innerWidth);
  vrefresh = getintparam("vrefresh", -1);
  if (vrefresh < 0 && fps >= 30) {
    vrefresh = fps;
  }

  try {
    sessionStorage.removeItem("password");
  } catch {
    //ignore
  }
  try {
    sessionStorage.removeItem("token");
  } catch {
    //ignore
  }

  let scale = 1;
  if (window.innerWidth !== override_width) {
    scale = override_width / window.innerWidth;
  }

  let progress_timer;
  const progress_value = 0;
  let progress_offset = 0;
  // show connection progress:
  function connection_progress(state, details, progress) {
    clog("connection_progress(", state, ", ", details, ", ", progress, ")");
    if (progress >= 100) {
      $("#progress").hide();
    } else {
      $("#progress").show();
    }
    $("#progress-label").text(state || " ");
    $("#progress-details").text(details || " ");
    $("#progress-bar").val(progress);
    const progress_value = progress;
    if (progress_timer) {
      window.clearTimeout(progress_timer);
      progress_timer = null;
    }
    if (progress < 100) {
      progress_move_offset();
    }
  }
  // the offset is just to make the user feel better
  // nothing changes, but we just show a slow progress
  function progress_move_offset() {
    progress_timer = null;
    progress_offset++;
    $("#progress-bar").val(progress_value + progress_offset);
    if (progress_offset < 9) {
      progress_timer = window.setTimeout(
        progress_move_offset,
        (5 + progress_offset) * progress_offset
      );
    }
  }

  let debug;
  const debug_categories = [];
  const categories = [
    "main",
    "keyboard",
    "geometry",
    "mouse",
    "clipboard",
    "draw",
    "audio",
    "network",
    "file",
  ];

  for (let i = 0; i < categories.length; i++) {
    const category = categories[i];
    debug = getboolparam(`debug_${category}`, false);
    if (debug) {
      debug_categories.push(category);
    }
  }
  clog("debug enabled for:", debug_categories);

  // create the client
  const client = new XpraClient("screen", default_settings);
  client.debug_categories = debug_categories;
  client.remote_logging = remote_logging;
  client.sharing = sharing;
  client.insecure = insecure;
  client.clipboard_enabled = clipboard;
  client.printing = printing;
  client.file_transfer = file_transfer;
  client.bandwidth_limit = bandwidth_limit;
  client.steal = steal;
  client.reconnect = reconnect;
  client.swap_keys = swap_keys;
  client.on_connection_progress = connection_progress;
  client.scroll_reverse_x = scroll_reverse_x;
  client.scroll_reverse_y = scroll_reverse_y;
  client.vrefresh = vrefresh;
  client.scale = scale;
  // example overrides:
  //   `client.HELLO_TIMEOUT = 3600000;`
  //   `client.PING_TIMEOUT = 60000;`
  //   `client.PING_GRACE = 30000;`
  //   `client.PING_FREQUENCY = 15000;`

  if (debug) {
    //example of client event hooks:
    client.on_open = function () {
      cdebug("network", "connection open");
    };
    client.on_connect = function () {
      cdebug("network", "connection established");
    };
    client.on_first_ui_event = function () {
      cdebug("network", "first ui event");
    };
    client.on_last_window = function () {
      cdebug("network", "last window disappeared");
    };
  }

  if (video) {
    // broadway h264 decoder:
    client.check_encodings.push("h264");
    if (JSMpeg && JSMpeg.Renderer && JSMpeg.Decoder) {
      //TODO: should be moved to 'check_encodings'
      //and added to the decode worker:
      client.supported_encodings.push("mpeg1");
    }
    if (mediasource_video) {
      client.supported_encodings.push("vp8+webm", "h264+mp4", "mpeg4+mp4");
    }
  }
  if (encoding) {
    // the primary encoding
    client.set_encoding(encoding);
  }
  client.offscreen_api = offscreen && client.offscreen_api;

  if (action && action != "connect") {
    const sns = {
      mode: action,
    };
    if (exit_with_children) {
      sns["exit-with-children"] = true;
      if (start) {
        sns["start-child"] = [start];
      }
    } else {
      if (start) {
        sns["start"] = [start];
      }
    }
    if (exit_with_client) {
      sns["exit-with-client"] = true;
    }
    client.start_new_session = sns;
  }

  // sound support
  if (sound) {
    client.audio_enabled = true;
    clog(`sound enabled, audio codec string: ${audio_codec}`);
    if (audio_codec && audio_codec.includes(":")) {
      const acparts = audio_codec.split(":");
      client.audio_framework = acparts[0];
      client.audio_codec = acparts[1];
    }
    client.audio_mediasource_enabled = getboolparam("mediasource", true);
    client.audio_aurora_enabled = getboolparam("aurora", true);
    client.audio_httpstream_enabled = getboolparam("http-stream", true);
  }

  if (keyboard_layout) {
    client.keyboard_layout = keyboard_layout;
  }

  // check for username and password
  if (username) {
    client.username = username;
  }
  if (passwords) {
    client.passwords = passwords;
  }
  if (action == "connect") {
    client.server_display = display;
  } else if (action == "shadow") {
    client.server_display = shadow_display;
  }

  // check for encryption parameters
  if (
    encryption &&
    !["0", "false", "no", "disabled"].includes(encryption.toLowerCase())
  ) {
    client.encryption = encryption.toUpperCase();
    if (key) {
      client.encryption_key = key;
    }
    console.log("encryption:", client.encryption);
  }

  // attach a callback for when client closes
  const debug_main = getboolparam("debug_main", false);
  if (!debug_main) {
    client.callback_close = function (reason) {
      clog("closing: ", reason);
      if (submit) {
        let message = "Connection closed (socket closed)";
        if (reason) {
          message = reason;
        }
        let url = "./connect.html";
        const has_session_storage = Utilities.hasSessionStorage();
        function add_prop(prop, value) {
          if (has_session_storage) {
            if (value === null || value === "undefined") {
              sessionStorage.removeItem(prop);
            } else {
              sessionStorage.setItem(prop, value);
            }
          } else {
            if (value === null || value === "undefined") {
              value = "";
            }
            url = `${url}&${prop}=${encodeURIComponent(`${value}`)}`;
          }
        }
        add_prop("disconnect", message);
        const props = {
          username,
          insecure,
          server,
          port,
          ssl,
          path,
          encryption,
          encoding,
          bandwidth_limit,
          keyboard_layout,
          swap_keys,
          scroll_reverse_x,
          scroll_reverse_y,
          reconnect,
          action,
          display,
          shadow_display,
          start,
          sound,
          audio_codec,
          keyboard,
          clipboard,
          printing,
          file_transfer,
          exit_with_children,
          exit_with_client,
          sharing,
          steal,
          video,
          mediasource_video,
          remote_logging,
          ignore_audio_blacklist,
          floating_menu,
          toolbar_position,
          autohide,
        };
        for (let i = 0; i < client.debug_categories.length; i++) {
          const category = client.debug_categories[i];
          props[`debug_${category}`] = true;
        }
        props["password"] =
          insecure || Utilities.hasSessionStorage() ? password : "";
        for (let name in props) {
          const value = props[name];
          add_prop(name, value);
        }
        window.location = url;
      } else {
        // if we didn't submit through the form, silently redirect to the connect gui
        window.location = "connect.html";
      }
    };
  }
  client.init(ignore_audio_blacklist);

  client.host = server;
  client.port = port;
  client.ssl = ssl;
  client.path = path.split("index.html")[0];
  return client;
}

function init_tablet_input(client) {
  //keyboard input for tablets:
  const pasteboard = $("#pasteboard");
  pasteboard.on("input", function (e) {
    const txt = pasteboard.val();
    pasteboard.val("");
    cdebug("keyboard", `oninput: '${txt}'`);
    if (!client.topwindow) {
      return;
    }
    for (let i = 0; i < txt.length; i++) {
      const str = txt[i];
      const keycode = str.charCodeAt(0);
      let keyname = str;
      if (str in CHAR_TO_NAME) {
        keyname = CHAR_TO_NAME[str];
        if (keyname.includes("_")) {
          //ie: Thai_dochada
          const lang = keyname.split("_")[0];
          const key_language = KEYSYM_TO_LAYOUT[lang];
          client._check_browser_language(key_language);
        }
      }
      try {
        const modifiers = [];
        const keyval = keycode;
        const group = 0;
        let packet = [
          "key-action",
          client.topwindow,
          keyname,
          true,
          modifiers,
          keyval,
          str,
          keycode,
          group,
        ];
        cdebug("keyboard", packet);
        client.send(packet);
        packet = [
          "key-action",
          client.topwindow,
          keyname,
          false,
          modifiers,
          keyval,
          str,
          keycode,
          group,
        ];
        cdebug("keyboard", packet);
        client.send(packet);
      } catch (error) {
        client.exc(error, "input handling error");
      }
    }
  });
}

function init_clipboard(client) {
  client.init_clipboard();
}

function init_keyboard(client) {
  const Keyboard = window.SimpleKeyboard.default;
  let kb = new Keyboard({
    onKeyPress: (button) => onKeyPress(button),
    onKeyReleased: (button) => onKeyReleased(button),
    display: {
      ".com": "|",
      "{tab}": "tab",
      "{lock}": "lock",
      "{shift}": "shift",
      "{bksp}": "bksp",
      "{space}": "space",
      "{enter}": "return",
    },
  });
  window.kb = kb;
  window.keyboardShifted = false;
  function onChange(input) {
    clog("Input changed", input);
  }
  function onKeyPress(button) {
    forward_key(true, button);
    if (button == "{shift}" || button == "{lock}") {
      if (window.keyboardShifted) {
        window.kb.setOptions({ layoutName: "default" });
      } else {
        window.kb.setOptions({ layoutName: "shift" });
      }
      window.keyboardShifted = !window.keyboardShifted;
    }
  }
  function onKeyReleased(button) {
    forward_key(false, button);
  }
  function forward_key(pressed, button) {
    let key =
      {
        "{bksp}": "Backspace",
        "{enter}": "Return",
        "{space}": "Space",
        "{tab}": "Tab",
        "{lock}": "CapsLock",
        "{shift}": "Shift",
        ".com": "|",
      }[button] || button;
    let e = {
      which: 0,
      keyCode: 0,
      key,
      code: key,
    };
    client.do_keyb_process(pressed, e);
  }
  const keyboard = getboolparam("keyboard", Utilities.isMobile());
  if (!keyboard) {
    $(".simple-keyboard").hide();
    $("#keyboard_button").css("color", "#777");
  } else {
    $(".simple-keyboard").show();
    $("#keyboard_button").css("color", "#111");
  }
}
function toggle_keyboard() {
  $(".simple-keyboard").toggle();
  if ($(".simple-keyboard").is(":visible")) {
    $("#keyboard_button").css("color", "#111");
  } else {
    $("#keyboard_button").css("color", "#777");
  }
}

function init_file_transfer(client) {
  function handleFileSelect(evt) {
    evt.stopPropagation();
    evt.preventDefault();
    client.send_all_files(evt.dataTransfer.files);
  }
  function handleDragOver(evt) {
    evt.stopPropagation();
    evt.preventDefault();
    evt.dataTransfer.dropEffect = "copy";
  }
  const screen = document.querySelector("#screen");
  screen.addEventListener("dragover", handleDragOver, false);
  screen.addEventListener("drop", handleFileSelect, false);

  $("#upload").on("change", function (evt) {
    evt.stopPropagation();
    evt.preventDefault();
    client.send_all_files(this.files);
    return false;
  });
  $("#upload_form").on("submit", function (evt) {
    evt.preventDefault();
  });
}

function init_clock(client, enabled) {
  if (!enabled) {
    $("#clock_menu_entry").hide();
    return;
  }
  function update_clock() {
    const now = Date.now();
    const server_time =
      client.last_ping_server_time +
      (now - client.last_ping_local_time) +
      client.server_ping_latency;
    const date = new Date(server_time);
    const clock_text = $("#clock_text");
    const width = clock_text.width();
    clock_text.text(
      `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`
    );
    const clock_menu_text = $("#clock_menu_text");
    clock_menu_text.text(
      `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`
    );
    if (width != clock_text.width()) {
      //trays have been shifted left or right:
      client.reconfigure_all_trays();
    }
    //try to land at the half-second point,
    //so that we never miss displaying a second:
    let delay = (1500 - (server_time % 1000)) % 1000;
    if (delay < 10) {
      delay = 1000;
    }
    setTimeout(update_clock, delay);
  }

  function wait_for_time() {
    if (client.last_ping_local_time > 0) {
      update_clock();
    } else {
      //check again soon:
      //(ideally, we should register a callback on the ping packet)
      setTimeout(wait_for_time, 1000);
    }
  }
  wait_for_time();
}

function init_audio(client) {
  client.on_audio_state_change = function (newstate, details) {
    if (client.audio_state == newstate) {
      return;
    }
    client.audio_state = newstate;
    let tooltip;
    let data_icon;
    if (newstate == "playing") {
      data_icon = "volume_up";
      tooltip = "audio playing,\nclick to stop";
    } else if (newstate == "waiting") {
      data_icon = "volume_up";
      tooltip = "audio buffering";
    } else {
      data_icon = "volume_off";
      tooltip = "audio off,\nclick to start";
    }
    clog("audio-state:", newstate);
    const sound_button_element = $("#sound_button");
    sound_button_element.attr("data-icon", data_icon);
    sound_button_element.attr("title", tooltip);
  };
  if (client.audio_enabled) {
    $("#sound_button").click(function () {
      clog("speaker icon clicked, audio_enabled=", client.audio_enabled);
      if (client.audio_state == "playing" || client.audio_state == "waiting") {
        client.on_audio_state_change("stopped", "user action");
        client.close_audio();
      } else {
        client.on_audio_state_change("waiting", "user action");
        client._audio_start_stream();
        client._sound_start_receiving();
      }
    });
  } else {
    $("#sound_button").hide();
  }
}

function toggle_fullscreen() {
  const f_el =
    Object.hasOwn(document, "requestFullScreen") ||
    Object.hasOwn(document, "webkitRequestFullScreen") ||
    Object.hasOwn(document, "mozRequestFullScreen") ||
    Object.hasOwn(document, "msRequestFullscreen");
  if (!f_el) {
    const elem = document.querySelector("#fullscreen_button");
    let is_fullscreen =
      document.fullScreen ||
      document.mozFullScreen ||
      document.webkitIsFullScreen;
    if (!is_fullscreen) {
      const req =
        elem.requestFullScreen ||
        elem.webkitRequestFullScreen ||
        elem.mozRequestFullScreen ||
        elem.msRequestFullscreen;
      if (req) {
        req.call(document.body);

        // event codes: https://www.w3.org/TR/uievents-code/#key-alphanumeric-writing-system
        const keys = [
          "AltLeft",
          "AltRight",
          "Tab",
          "Escape",
          "ContextMenu",
          "MetaLeft",
          "MetaRight",
          "F1",
          "F2",
          "F3",
          "F4",
          "F5",
          "F6",
          "F7",
          "F8",
          "F9",
          "F10",
          "F11",
        ];
        navigator.keyboard
          .lock(keys)
          .then(() => {
            console.log("keyboard lock success");
          })
          .catch((error) => {
            console.log("keyboard lock failed:", error);
          });

        $("#fullscreen").attr("src", "./icons/unfullscreen.png");
        elem.title = "Exit Fullscreen";
        $("#fullscreen_button").attr("data-icon", "fullscreen_exit");
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
      } else if (Object.hasOwn((document, "mozCancelFullScreen"))) {
        document.mozCancelFullScreen();
      } else if (Object.hasOwn((document, "msExitFullscreen"))) {
        document.msExitFullscreen();
      }

      $("#fullscreen").attr("src", "./icons/fullscreen.png");
      elem.title = "Fullscreen";
      $("#fullscreen_button").attr("data-icon", "fullscreen");
    }
  }
}

function expand_float_menu() {
  const expanded_width = float_menu_item_size * 5;
  const float_menu = document.querySelector("#float_menu");
  float_menu.style.display = "inline-block";
  float_menu.style.width = `${expanded_width}px`;
  $("#float_menu").children().show();
  if (client) {
    client.reconfigure_all_trays();
  }
}

function retract_float_menu() {
  document.querySelector("#float_menu").style.width = "0px";
  $("#float_menu").children().hide();
}

function init_float_menu() {
  const toolbar_position = getparam("toolbar_position");
  const floating_menu = getboolparam("floating_menu", true);
  const autohide = getboolparam("autohide", false);
  const float_menu_element = $("#float_menu");
  if (!floating_menu) {
    //nothing to do, it starts hidden
    return;
  }
  float_menu_element.fadeIn();
  if (client) {
    client.toolbar_position = toolbar_position;
  }
  if (autohide) {
    float_menu_element.on("mouseover", expand_float_menu);
    float_menu_element.on("mouseout", retract_float_menu);
    // Expand and retract the floating menu so it
    // is correctly positioned and collapsed
    expand_float_menu();
    retract_float_menu();
  } else {
    expand_float_menu();
  }
}

let client;
function init_page() {
  const touchaction = getparam("touchaction") || "scroll";
  touchaction_scroll = touchaction == "scroll";
  set_touchaction();

  client = init_client();
  addEventListener(
    "unload",
    () => {
      clog("onunload()");
      client.close();
    },
    { capture: true }
  );

  addEventListener(
    "beforeunload",
    () => {
      const aft = client.active_file_transfers();
      clog("beforeunload(", event, ") active_file_transfers()=", aft);
      if (aft > 0) {
        //This text is now ignored by all browsers...
        event.returnValue =
          "There are file transfers in progress.\nAre you sure you want to leave?";
      }
      return event.returnValue;
    },
    { capture: true }
  );
  client.on_connect = function () {
    init_float_menu();
    enable_clipboard_autofocus();
    client.capture_keyboard = true;
  };
  const blocked_hosts = (getparam("blocked-hosts") || "").split(",");
  if (blocked_hosts.includes(client.host.toLowerCase())) {
    client.callback_close(
      `connection to host '${client.host.replace(
        /[^\d.:A-Za-z]/g,
        ""
      )}' blocked`
    );
  } else {
    client.connect();
  }

  //from now on, send log and debug to client function
  //which may forward it to the server once connected:
  clog = function () {
    if (client) {
      client.log.apply(client, arguments);
    }
  };
  cdebug = function () {
    if (client) {
      client.debug.apply(client, arguments);
    }
  };
  init_tablet_input(client);
  if (client.clipboard_enabled) {
    init_clipboard(client);
  }
  if (client.file_transfer) {
    init_file_transfer(client);
  } else {
    $("upload_link").removeAttr("href");
  }
  init_keyboard(client);
  init_clock(client, getboolparam("clock", true));
  init_audio(client);
  document.addEventListener("visibilitychange", function (e) {
    const window_ids = Object.keys(client.id_to_window).map(Number);
    clog(
      "visibilitychange hidden=",
      document.hidden,
      "connected=",
      client.connected
    );
    if (client.connected) {
      if (document.hidden) {
        client.suspend();
      } else {
        client.resume();
      }
    }
  });
  client.password_prompt_fn = password_prompt_fn;
  client.keycloak_prompt_fn = keycloak_prompt_fn;
  $("#fullscreen").on("click", function (e) {
    toggle_fullscreen();
  });

  $("#fullscreen_button").on("click", function (e) {
    toggle_fullscreen();
  });

  $("#keyboard_button").on("click", function (e) {
    toggle_keyboard();
  });

  // Configure Xpra tray window list right click behavior.
  $("#open_windows_list")
    .siblings("a")
    .on("mousedown", (e) => {
      if (e.buttons === 2) {
        client.toggle_window_preview();
      }
    });

  const screen_change_events =
    "webkitfullscreenchange mozfullscreenchange fullscreenchange MSFullscreenChange";
  $(document).on(screen_change_events, function () {
    const f_el =
      document.fullscreenElement ||
      document.mozFullScreen ||
      document.webkitIsFullScreen ||
      document.msFullscreenElement;
    clog("fullscreenchange:", f_el);
    if (f_el == null) {
      //we're not in fullscreen mode now, so show fullscreen icon again:
      $("#fullscreen_button").attr("data-icon", "fullscreen");
    }
  });
  // disable right click menu:
  window.oncontextmenu = function (e) {
    if (
      client.clipboard_direction === "to-client" ||
      client.clipboard_direction === "both"
    ) {
      client._poll_clipboard(e);
    }
    e.preventDefault();
    e.stopPropagation();
    return false;
  };

  // Send clipboard from browser on focus if client-to-server clipboard is enabled.
  $(window).on("focus", (e) => {
    if (
      client.clipboard_direction === "to-server" ||
      client.clipboard_direction === "both"
    ) {
      client._poll_clipboard(e);
    }
  });

  // Prevent stuck keys.
  $(window).on("blur", (e) => {
    if (client.last_key_packet.length > 2 && client.last_keycode_pressed > 0) {
      console.log(`clearing keycode: ${client.last_keycode_pressed}`);
      key_packet = client.last_key_packet;
      // Set pressed = false to indicate key up.
      key_packet[3] = false;
      client.send(key_packet);
      client.last_key_packet = [];
    }
  });
}

function load_default_settings() {
  const xhr = new XMLHttpRequest();
  xhr.open("GET", "./default-settings.txt");
  xhr.onload = function () {
    const tmp_default_settings = Utilities.parseINIString(xhr.responseText);
    clog("network", "got default settings:", tmp_default_settings);
    //update the default settings object
    //so getparam will look there
    for (const key in tmp_default_settings) {
      default_settings[key] = tmp_default_settings[key];
    }
    init_page();
  };
  xhr.onerror = function () {
    clog("network", "default settings request failed with code", xhr.status);
    init_page();
  };
  xhr.onabort = function () {
    clog("network", "default settings request aborted");
    init_page();
  };
  xhr.send();
}

$(document).ready(function () {
  clog(
    "document is ready, browser is",
    navigator.platform,
    "64-bit:",
    Utilities.is_64bit()
  );
  load_default_settings();
});
