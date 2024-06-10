document
  .getElementById("restore")
  .addEventListener("change", handleFileSelect, false);
document.getElementById("btn-backup").onclick = handleEncPasswdSubmit;
document.getElementById("btn-upload-fallback").onclick = showFallbackCkzInput;

function handleEncPasswdSubmit(e) {
  e.preventDefault();

  // Get the current active tab
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const activeTab = tabs[0];
    const url = new URL(activeTab.url);
    const domain = url.hostname.startsWith("www.")
      ? url.hostname.slice(4)
      : url.hostname;

    // Get all cookies for the current domain and subdomains
    chrome.cookies.getAll({ domain: domain }, (cookies) => {
      if (cookies.length > 0) {
        const data = JSON.stringify(cookies); // No encryption
        const d = new Date();
        const date = d.toLocaleDateString("en-GB").replace(/\//g, "-");
        const time = d.toLocaleTimeString("en-GB").replace(/:/g, "-");
        const filename = `cookies-${domain}-${date}-${time}.ckz`;
        downloadJson(data, filename);
        backupSuccessAlert(cookies.length);
      } else {
        alert(`No cookies to backup for ${domain}!`);
      }
    });
  });
}

let cookieFile;

function handleFileSelect(e) {
  cookieFile = e.target.files[0];
  if (!cookieFile || !cookieFile.name.endsWith(".ckz")) {
    alert("Not a .ckz file. Please select again!");
    hideDecPasswordInputBox();
    return;
  }
  hideFallbackCkzButton();
  handleDecPasswdSubmit(); // Automatically call the submit function
}

function handleDecPasswdSubmit(e) {
  if (e) e.preventDefault();

  getCkzFileDataAsText(async (data) => {
    let cookies;

    try {
      cookies = JSON.parse(data);
      console.log(cookies);
    } catch (error) {
      console.log(error);
      alert("Invalid .ckz file format!");
      return;
    }

    initRestoreProgressBar(cookies.length);

    let total = 0;
    const epoch = new Date().getTime() / 1000;

    for (const cookie of cookies) {
      let url =
        "http" +
        (cookie.secure ? "s" : "") +
        "://" +
        (cookie.domain.startsWith(".")
          ? cookie.domain.slice(1)
          : cookie.domain) +
        cookie.path;

      if (epoch > cookie.expirationDate) {
        expirationWarning(cookie.name, url);
        continue;
      }

      if (cookie.hostOnly == true) {
        delete cookie.domain;
      }
      if (cookie.session == true) {
        delete cookie.expirationDate;
      }

      delete cookie.hostOnly;
      delete cookie.session;
      cookie.url = url;

      let c = await new Promise((resolve, reject) => {
        chrome.cookies.set(cookie, resolve);
      });

      if (c == null) {
        console.error(
          "Error while restoring the cookie for the URL " + cookie.url
        );
        console.error(JSON.stringify(cookie));
        console.error(JSON.stringify(chrome.runtime.lastError));
        unknownErrWarning(cookie.name, cookie.url);
      } else {
        total++;
        updateRestoreProgressBar(total);
      }
    }

    restoreSuccessAlert(total, cookies.length);
    hideRestoreProgressBar();
  });
}

function createWarning(text) {
  const div = document.createElement("div");
  div.classList.add("alert", "alert-warning");
  div.innerHTML = text;
  return div;
}

function createSuccessAlert(text) {
  const div = document.createElement("div");
  div.classList.add("alert", "alert-success");
  div.innerHTML = text;
  return div;
}

function unknownErrWarning(cookie_name, cookie_url) {
  if (cookie_name && cookie_url) {
    addToWarningMessageList(
      createWarning(
        `Cookie ${cookie_name} for the domain ${cookie_url} could not be restored`
      )
    );
  }
}

function expirationWarning(cookie_name, cookie_url) {
  if (cookie_name && cookie_url) {
    addToWarningMessageList(
      createWarning(
        `Cookie ${cookie_name} for the domain ${cookie_url} has expired`
      )
    );
  }
}

function backupSuccessAlert(totalCookies) {
  addToSuccessMessageList(
    createSuccessAlert(
      `Successfully backed up <b>${totalCookies.toLocaleString()}</b> cookies!`
    )
  );
}

function restoreSuccessAlert(restoredCookies, totalCookies) {
  addToSuccessMessageList(
    createSuccessAlert(
      `Successfully restored <b>${restoredCookies.toLocaleString()}</b> cookies out of <b>${totalCookies.toLocaleString()}</b>`
    )
  );
}

function hideBackupButton() {
  document.getElementById("btn-backup").style.display = "none";
}

function hideDecPasswordInputBox(e) {
  document.getElementById("dec-passwd").style.display = "none";
}

function addToSuccessMessageList(node) {
  document.getElementById("messages").appendChild(node);
}

function addToWarningMessageList(node) {
  document.getElementById("warnings").appendChild(node);
}

function initRestoreProgressBar(maxVal) {
  document.getElementById("progress").style.display = "block";
  document.getElementById("progressbar").setAttribute("max", maxVal);
}

function updateRestoreProgressBar(val) {
  document.getElementById("progressbar").setAttribute("value", val);
}

function hideRestoreProgressBar() {
  document.getElementById("progressbar").setAttribute("value", 0);
  document.getElementById("progress").style.display = "none";
}

function hideFallbackCkzButton() {
  document.getElementById("btn-upload-fallback").style.display = "none";
}

function showFallbackCkzInput() {
  hideFallbackCkzButton();
  document.getElementById("restore-upload-wrap").style.display = "none";
  document.getElementById("restore-using-text-wrap").style.display = "flex";
}

function getCkzFileContentsFromTextarea() {
  return document.getElementById("ckz-textarea").value.trim();
}

function downloadJson(data, filename) {
  const blob = new Blob([data], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function getCkzFileDataAsText(cb) {
  if (cookieFile) {
    const reader = new FileReader();
    reader.readAsText(cookieFile);
    reader.onload = (e) => {
      cb(e.target.result);
    };
    reader.onerror = (e) => {
      console.error(e);
      alert("Unknown error while reading the .ckz file!");
    };
  } else {
    cb(getCkzFileContentsFromTextarea());
  }
}
