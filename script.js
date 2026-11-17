/* ==============================
   0) YAXINLAŞDIRMANI BLOKLA
   Ctrl + təkər, Ctrl + / Ctrl -, touchpad və barmaqla (telefon)
   ============================== */
document.addEventListener("wheel", function (e) {
  if (e.ctrlKey) e.preventDefault();
}, { passive: false });

document.addEventListener("keydown", function (e) {
  if (!(e.ctrlKey || e.metaKey)) return;
  var keys = ["+", "-", "=", "_", "0"];
  var codes = ["Equal", "Minus", "Digit0", "NumpadAdd", "NumpadSubtract", "Numpad0"];
  if (keys.indexOf(e.key) > -1 || codes.indexOf(e.code) > -1) e.preventDefault();
});

["gesturestart", "gesturechange", "gestureend"].forEach(function (t) {
  document.addEventListener(t, function (e) { e.preventDefault(); });
});

document.addEventListener("touchmove", function (e) {
  if (e.touches.length > 1) e.preventDefault();
}, { passive: false });

/* ==============================
   1) LOGONU TAP
   Qovluqdakı logo.png, logo.webp, logo.jpg, logo.jpeg, logo.svg
   fayllarından hansı varsa onu götürür.
   ============================== */
var logo = document.getElementById("logo");
var logoNames = ["logo.png", "logo.webp", "logo.jpg", "logo.jpeg", "logo.svg"];
var logoIndex = 0;

logo.onerror = function () {
  logoIndex++;
  if (logoIndex < logoNames.length) {
    logo.src = logoNames[logoIndex];
  } else {
    logo.onerror = null; // heç biri tapılmadı
  }
};

/* ==============================
   2) AÇILIŞ ANİMASİYASI
   2.6 saniyə sonra logo sol üst küncə gedir.
   ============================== */
setTimeout(function () {
  document.body.classList.add("docked");
  document.body.classList.remove("intro");
}, 2600);

/* ==============================
   3) SƏHİFƏ KEÇİDİ
   #home  #qoshul  #qeydiyyat  #giris  #profil
   ============================== */
var pages = ["home", "qoshul", "qeydiyyat", "giris", "profil"];
var me = null;          // daxil olmuş istifadəçi
var profile = null;     // Firestore-dakı məlumatları
var authReady = false;  // Firebase cavab verdi?

function showPage() {
  var h = location.hash.replace("#", "") || "home";
  if (pages.indexOf(h) < 0) h = "home";

  if (authReady) {
    // Daxil olubsa: giriş/qeydiyyat səhifələri açılmasın
    if (me && (h === "qoshul" || h === "qeydiyyat" || h === "giris")) {
      location.hash = "#home";
      return;
    }
    // Daxil olmayıbsa: profil açılmasın
    if (!me && h === "profil") {
      location.hash = "#giris";
      return;
    }
  }

  swapView(h);
}

/* Köhnə səhifə solur (0.25 san), sonra yenisi gəlir */
var switching = 0;
var firstView = true;

function swapView(h) {
  var next = document.getElementById("view-" + h);
  var cur = document.querySelector(".view.active");

  // İlk açılış: animasiyasız
  if (firstView) {
    firstView = false;
    pages.forEach(function (p) {
      document.getElementById("view-" + p).classList.toggle("active", p === h);
    });
    return;
  }

  // Eyni səhifədir (və ya solmaqdan geri qayıdıb)
  if (cur === next) {
    cur.classList.remove("leave");
    switching++;
    return;
  }

  var id = ++switching;
  if (cur) cur.classList.add("leave");

  setTimeout(function () {
    if (id !== switching) return; // arada başqa keçid olub
    pages.forEach(function (p) {
      document.getElementById("view-" + p).classList.remove("active", "leave");
    });
    next.classList.add("active");
    window.scrollTo(0, 0);
  }, 250);
}
window.addEventListener("hashchange", showPage);

/* ==============================
   4) FIREBASE
   ============================== */
firebase.initializeApp(firebaseConfig);
var auth = firebase.auth();
var db = firebase.firestore();
var busy = false; // qeydiyyat zamanı gözləmək üçün

var fields = [
  ["fullName", "Ad Soyad"],
  ["pubgId", "PUBG Mobile ID"],
  ["age", "Yaş"],
  ["phone", "Əlaqə nömrəsi"],
  ["email", "E-poçt"],
  ["clan", "Klan"],
  ["role", "Oyunçu rolu"],
  ["message", "Mesaj"]
];

function errText(x) {
  var m = {
    "auth/email-already-in-use": "Bu e-poçt artıq qeydiyyatdan keçib.",
    "auth/invalid-email": "E-poçt düzgün deyil.",
    "auth/weak-password": "Şifrə ən azı 6 simvol olmalıdır.",
    "auth/invalid-credential": "E-poçt və ya şifrə səhvdir.",
    "auth/user-not-found": "E-poçt və ya şifrə səhvdir.",
    "auth/wrong-password": "E-poçt və ya şifrə səhvdir.",
    "auth/too-many-requests": "Çox cəhd edildi, bir az sonra yenidən yoxla.",
    "auth/network-request-failed": "İnternet bağlantısını yoxla.",
    "permission-denied": "Məlumatı yazmaq olmadı (Firestore qaydalarını yoxla)."
  };
  return m[x.code] || "Xəta baş verdi: " + (x.code || x.message);
}

/* Ekranı istifadəçinin vəziyyətinə görə yenilə */
function render() {
  var name = (profile && profile.fullName) || (me && me.email) || "";

  document.getElementById("nav").hidden = !me;
  document.getElementById("welcome").hidden = !me;
  document.getElementById("welcome-name").textContent = name;

  var cta = document.getElementById("cta");
  cta.textContent = me ? "Profilim" : "Komandamıza qoşul";
  cta.href = me ? "#profil" : "#qoshul";

  var list = document.getElementById("profile-list");
  list.textContent = "";
  fields.forEach(function (f) {
    var v = profile && profile[f[0]];
    if (v === undefined || v === "") v = "—";
    var row = document.createElement("div");
    row.className = "row";
    var l = document.createElement("span");
    l.textContent = f[1];
    var b = document.createElement("b");
    b.textContent = v;
    row.appendChild(l);
    row.appendChild(b);
    list.appendChild(row);
  });

  showPage();
}

/* İstifadəçini və onun məlumatlarını yüklə */
function setUser(u) {
  if (!u) {
    me = null;
    profile = null;
    authReady = true;
    render();
    return;
  }
  db.collection("players").doc(u.uid).get()
    .then(function (d) { profile = d.exists ? d.data() : {}; })
    .catch(function () { profile = {}; })
    .then(function () { me = u; authReady = true; render(); });
}

auth.onAuthStateChanged(function (u) {
  if (!busy) setUser(u);
});

/* ----- Qeydiyyat ----- */
document.getElementById("reg-form").addEventListener("submit", function (e) {
  e.preventDefault();
  var f = e.target, E = f.elements;
  var err = document.getElementById("reg-err");
  var btn = f.querySelector("button");
  err.textContent = "";

  var d = {
    fullName: E.fullName.value.trim(),
    pubgId: E.pubgId.value.trim(),
    age: Number(E.age.value),
    phone: E.phone.value.trim(),
    clan: E.clan.value,
    role: E.role.value,
    message: E.message.value.trim()
  };

  if (!/^\d{5,15}$/.test(d.pubgId)) {
    err.textContent = "PUBG ID yalnız rəqəmlərdən ibarət olmalıdır.";
    return;
  }

  btn.disabled = true;
  busy = true;

  auth.createUserWithEmailAndPassword(E.email.value.trim(), E.password.value)
    .then(function (c) {
      d.email = c.user.email;
      d.createdAt = firebase.firestore.FieldValue.serverTimestamp();
      return db.collection("players").doc(c.user.uid).set(d);
    })
    .then(function () {
      busy = false;
      f.reset();
      setUser(auth.currentUser);
    })
    .catch(function (x) {
      busy = false;
      err.textContent = errText(x);
      if (auth.currentUser) setUser(auth.currentUser);
    })
    .then(function () { btn.disabled = false; });
});

/* ----- Giriş ----- */
document.getElementById("login-form").addEventListener("submit", function (e) {
  e.preventDefault();
  var f = e.target, E = f.elements;
  var err = document.getElementById("login-err");
  var btn = f.querySelector("button");
  err.textContent = "";
  btn.disabled = true;

  auth.signInWithEmailAndPassword(E.email.value.trim(), E.password.value)
    .then(function () { f.reset(); })
    .catch(function (x) { err.textContent = errText(x); })
    .then(function () { btn.disabled = false; });
});

/* ----- Çıxış ----- */
document.getElementById("logout").addEventListener("click", function () {
  auth.signOut().then(function () { location.hash = "#home"; });
});

showPage();
