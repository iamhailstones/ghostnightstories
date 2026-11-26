package main

import (
	"encoding/json"
	"log"
	"net"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"
)

type App struct {
	st     *Store
	secret []byte
	origin string
	mu     sync.Mutex
	hits   map[string][]time.Time
}

func env(k, d string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return d
}

func main() {
	secret := os.Getenv("JWT_SECRET")
	if len(secret) < 32 {
		log.Fatal("JWT_SECRET must be set and at least 32 characters")
	}
	st := NewStore(env("DATA_FILE", "data.json"))
	st.EnsureAdmin(os.Getenv("ADMIN_EMAIL"), os.Getenv("ADMIN_PASSWORD"))
	a := &App{st: st, secret: []byte(secret), origin: env("CORS_ORIGIN", "http://localhost:5173"), hits: map[string][]time.Time{}}
	mux := http.NewServeMux()
	a.routes(mux)
	srv := &http.Server{Addr: ":" + env("PORT", "8080"), Handler: a.middleware(mux), ReadHeaderTimeout: 5 * time.Second}
	log.Println("Ghost Night Stories API on", srv.Addr)
	log.Fatal(srv.ListenAndServe())
}

func clientIP(r *http.Request) string {
	if f := r.Header.Get("X-Forwarded-For"); f != "" {
		return strings.TrimSpace(strings.Split(f, ",")[0])
	}
	ip, _, _ := net.SplitHostPort(r.RemoteAddr)
	return ip
}

func (a *App) middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		h := w.Header()
		h.Set("Access-Control-Allow-Origin", a.origin)
		h.Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		h.Set("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS")
		h.Set("X-Content-Type-Options", "nosniff")
		h.Set("Referrer-Policy", "no-referrer")
		if r.Method == http.MethodOptions {
			w.WriteHeader(204)
			return
		}
		if !strings.HasPrefix(r.URL.Path, "/uploads/") && !a.allow(clientIP(r), 120) {
			writeErr(w, 429, "Too many requests. Wait a minute and try again.")
			return
		}
		limit := int64(1 << 20)
		if r.URL.Path == "/api/admin/upload" {
			limit = 6 << 20
		}
		r.Body = http.MaxBytesReader(w, r.Body, limit)
		next.ServeHTTP(w, r)
	})
}

// allow permits n hits per minute per key.
func (a *App) allow(key string, n int) bool {
	a.mu.Lock()
	defer a.mu.Unlock()
	now := time.Now()
	var keep []time.Time
	for _, t := range a.hits[key] {
		if now.Sub(t) < time.Minute {
			keep = append(keep, t)
		}
	}
	if len(keep) >= n {
		a.hits[key] = keep
		return false
	}
	a.hits[key] = append(keep, now)
	return true
}

func writeJSON(w http.ResponseWriter, code int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(v)
}
func writeErr(w http.ResponseWriter, code int, msg string) {
	writeJSON(w, code, map[string]string{"error": msg})
}
func readJSON(w http.ResponseWriter, r *http.Request, v any) bool {
	if err := json.NewDecoder(r.Body).Decode(v); err != nil {
		writeErr(w, 400, "Invalid request body")
		return false
	}
	return true
}
func clip(s string, n int) string {
	s = strings.TrimSpace(s)
	if len(s) > n {
		return s[:n]
	}
	return s
}
