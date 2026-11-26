package main

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"strings"
	"time"
)

func pbkdf2(pw, salt []byte, iter, keyLen int) []byte {
	prf := hmac.New(sha256.New, pw)
	n := (keyLen + prf.Size() - 1) / prf.Size()
	var dk []byte
	for b := 1; b <= n; b++ {
		prf.Reset()
		prf.Write(salt)
		prf.Write([]byte{byte(b >> 24), byte(b >> 16), byte(b >> 8), byte(b)})
		u := prf.Sum(nil)
		t := append([]byte{}, u...)
		for i := 1; i < iter; i++ {
			prf.Reset()
			prf.Write(u)
			u = prf.Sum(nil)
			for j := range t {
				t[j] ^= u[j]
			}
		}
		dk = append(dk, t...)
	}
	return dk[:keyLen]
}

func hashPW(pw string) (string, string) {
	s := make([]byte, 16)
	rand.Read(s)
	return hex.EncodeToString(pbkdf2([]byte(pw), s, 120000, 32)), hex.EncodeToString(s)
}

func checkPW(pw, hash, salt string) bool {
	s, err := hex.DecodeString(salt)
	if err != nil {
		return false
	}
	got := hex.EncodeToString(pbkdf2([]byte(pw), s, 120000, 32))
	return subtle.ConstantTimeCompare([]byte(got), []byte(hash)) == 1
}

func (a *App) sign(uid int) string {
	p, _ := json.Marshal(map[string]int64{"u": int64(uid), "e": time.Now().Add(14 * 24 * time.Hour).Unix()})
	body := base64.RawURLEncoding.EncodeToString(p)
	m := hmac.New(sha256.New, a.secret)
	m.Write([]byte(body))
	return body + "." + base64.RawURLEncoding.EncodeToString(m.Sum(nil))
}

// userID returns the authenticated user id, or 0.
func (a *App) userID(r *http.Request) int {
	parts := strings.Split(strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer "), ".")
	if len(parts) != 2 {
		return 0
	}
	m := hmac.New(sha256.New, a.secret)
	m.Write([]byte(parts[0]))
	want := base64.RawURLEncoding.EncodeToString(m.Sum(nil))
	if subtle.ConstantTimeCompare([]byte(want), []byte(parts[1])) != 1 {
		return 0
	}
	raw, err := base64.RawURLEncoding.DecodeString(parts[0])
	if err != nil {
		return 0
	}
	var p map[string]int64
	if json.Unmarshal(raw, &p) != nil || p["e"] < time.Now().Unix() {
		return 0
	}
	return int(p["u"])
}

func (a *App) register(w http.ResponseWriter, r *http.Request) {
	if !a.allow("reg:"+clientIP(r), 5) {
		writeErr(w, 429, "Too many attempts. Try again later.")
		return
	}
	var in struct{ Email, Name, Password string }
	if !readJSON(w, r, &in) {
		return
	}
	email := strings.ToLower(clip(in.Email, 120))
	if !strings.Contains(email, "@") || len(in.Password) < 8 {
		writeErr(w, 400, "Use a valid email and a password of at least 8 characters")
		return
	}
	a.st.mu.Lock()
	defer a.st.mu.Unlock()
	for _, u := range a.st.D.Users {
		if u.Email == email {
			writeErr(w, 409, "That email is already registered")
			return
		}
	}
	h, s := hashPW(in.Password)
	a.st.D.NextID++
	u := User{ID: a.st.D.NextID, Email: email, Name: clip(in.Name, 40), Hash: h, Salt: s, Role: "reader", Bookmarks: []int{}, Progress: map[string]int{}}
	a.st.D.Users = append(a.st.D.Users, u)
	a.st.save()
	writeJSON(w, 200, map[string]any{"token": a.sign(u.ID), "user": u.pub()})
}

func (a *App) login(w http.ResponseWriter, r *http.Request) {
	if !a.allow("login:"+clientIP(r), 10) {
		writeErr(w, 429, "Too many attempts. Try again later.")
		return
	}
	var in struct{ Email, Password string }
	if !readJSON(w, r, &in) {
		return
	}
	email := strings.ToLower(strings.TrimSpace(in.Email))
	a.st.mu.RLock()
	defer a.st.mu.RUnlock()
	for _, u := range a.st.D.Users {
		if u.Email == email && checkPW(in.Password, u.Hash, u.Salt) {
			writeJSON(w, 200, map[string]any{"token": a.sign(u.ID), "user": u.pub()})
			return
		}
	}
	writeErr(w, 401, "Email or password is incorrect")
}
