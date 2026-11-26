package main

import (
	"net/http"
	"sort"
	"strconv"
	"strings"
	"time"
)

func (a *App) routes(m *http.ServeMux) {
	m.HandleFunc("GET /api/health", func(w http.ResponseWriter, r *http.Request) { writeJSON(w, 200, map[string]string{"status": "ok"}) })
	m.HandleFunc("GET /api/stories", a.listStories)
	m.HandleFunc("GET /api/stories/{id}", a.getStory)
	m.HandleFunc("POST /api/stories/{id}/report", a.reportStory)
	m.HandleFunc("GET /api/interactive", func(w http.ResponseWriter, r *http.Request) {
		a.st.mu.RLock()
		defer a.st.mu.RUnlock()
		writeJSON(w, 200, a.st.D.Interactive)
	})
	m.HandleFunc("GET /api/archive", func(w http.ResponseWriter, r *http.Request) {
		a.st.mu.RLock()
		defer a.st.mu.RUnlock()
		writeJSON(w, 200, a.st.D.Archive)
	})
	m.HandleFunc("GET /api/mysteries", a.listMysteries)
	m.HandleFunc("POST /api/mysteries/{id}/theories", a.addTheory)
	m.HandleFunc("POST /api/submissions", a.submit)
	m.HandleFunc("GET /api/videos/play", a.playVideos)
	m.HandleFunc("POST /api/auth/register", a.register)
	m.HandleFunc("POST /api/auth/login", a.login)
	m.HandleFunc("GET /api/me", a.user(a.me))
	m.HandleFunc("POST /api/me/bookmarks/{id}", a.user(a.toggleBookmark))
	m.HandleFunc("POST /api/me/progress/{id}", a.user(a.saveProgress))
	m.HandleFunc("GET /uploads/{name}", a.serveUpload)
	// admin
	m.HandleFunc("GET /api/admin/stories", a.admin(a.allStories))
	m.HandleFunc("POST /api/admin/stories", a.admin(a.createStory))
	m.HandleFunc("PUT /api/admin/stories/{id}", a.admin(a.updateStory))
	m.HandleFunc("POST /api/admin/upload", a.admin(a.upload))
	m.HandleFunc("GET /api/admin/stats", a.admin(a.stats))
	m.HandleFunc("GET /api/admin/queue", a.admin(a.queue))
	m.HandleFunc("POST /api/admin/stories/{id}/status", a.admin(a.setStatus))
	m.HandleFunc("DELETE /api/admin/stories/{id}", a.admin(a.deleteStory))
	m.HandleFunc("POST /api/admin/mysteries", a.admin(a.addMystery))
	m.HandleFunc("GET /api/admin/videos", a.admin(a.adminVideos))
	m.HandleFunc("POST /api/admin/videos", a.admin(a.addVideo))
	m.HandleFunc("POST /api/admin/videos/{id}/test", a.admin(a.testVideo))
	m.HandleFunc("PATCH /api/admin/videos/{id}", a.admin(a.patchVideo))
	m.HandleFunc("DELETE /api/admin/videos/{id}", a.admin(a.deleteVideo))
}

type uh func(http.ResponseWriter, *http.Request, int)

// user wraps a handler that needs a signed-in user.
func (a *App) user(h uh) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := a.userID(r)
		if id == 0 {
			writeErr(w, 401, "Sign in to continue")
			return
		}
		h(w, r, id)
	}
}

// admin wraps a handler that needs an administrator.
func (a *App) admin(h http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := a.userID(r)
		a.st.mu.RLock()
		role := ""
		for _, u := range a.st.D.Users {
			if u.ID == id {
				role = u.Role
			}
		}
		a.st.mu.RUnlock()
		if id == 0 {
			writeErr(w, 401, "Sign in to continue")
			return
		}
		if role != "admin" {
			writeErr(w, 403, "Administrator access required")
			return
		}
		h(w, r)
	}
}

func pathID(r *http.Request) int { n, _ := strconv.Atoi(r.PathValue("id")); return n }

func (a *App) listStories(w http.ResponseWriter, r *http.Request) {
	q := strings.ToLower(r.URL.Query().Get("q"))
	cat := r.URL.Query().Get("category")
	sortBy := r.URL.Query().Get("sort")
	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	if page < 1 {
		page = 1
	}
	const per = 12
	a.st.mu.RLock()
	out := []Story{}
	for _, s := range a.st.D.Stories {
		if s.Status != "published" || (cat != "" && s.Category != cat) {
			continue
		}
		if q != "" && !strings.Contains(strings.ToLower(s.Title+" "+s.Desc+" "+s.Category), q) {
			continue
		}
		out = append(out, s)
	}
	a.st.mu.RUnlock()
	sort.Slice(out, func(i, j int) bool {
		switch sortBy {
		case "m":
			return out[i].Minutes < out[j].Minutes
		case "n":
			return out[i].ID > out[j].ID
		}
		return out[i].Intensity > out[j].Intensity
	})
	total := len(out)
	lo := (page - 1) * per
	if lo > total {
		lo = total
	}
	hi := lo + per
	if hi > total {
		hi = total
	}
	writeJSON(w, 200, map[string]any{"items": out[lo:hi], "total": total})
}

func (a *App) getStory(w http.ResponseWriter, r *http.Request) {
	id := pathID(r)
	a.st.mu.RLock()
	defer a.st.mu.RUnlock()
	for _, s := range a.st.D.Stories {
		if s.ID == id && s.Status == "published" {
			writeJSON(w, 200, s)
			return
		}
	}
	writeErr(w, 404, "Story not found")
}

func (a *App) reportStory(w http.ResponseWriter, r *http.Request) {
	id := pathID(r)
	if !a.allow("rep:"+clientIP(r), 5) {
		writeErr(w, 429, "Too many reports")
		return
	}
	a.st.mu.Lock()
	defer a.st.mu.Unlock()
	for i := range a.st.D.Stories {
		if a.st.D.Stories[i].ID == id {
			a.st.D.Stories[i].Reports++
			a.st.save()
			writeJSON(w, 200, map[string]string{"status": "reported"})
			return
		}
	}
	writeErr(w, 404, "Story not found")
}

func (a *App) listMysteries(w http.ResponseWriter, r *http.Request) {
	today := time.Now().UTC().Format("2006-01-02")
	a.st.mu.RLock()
	defer a.st.mu.RUnlock()
	out := []Mystery{}
	for _, m := range a.st.D.Mysteries {
		if m.Date > today {
			continue
		}
		if m.Date >= today {
			m.Reveal = "" // revelation unlocks the next day
		}
		out = append(out, m)
	}
	writeJSON(w, 200, out)
}

func (a *App) addTheory(w http.ResponseWriter, r *http.Request) {
	id := pathID(r)
	var in struct{ Text string }
	if !readJSON(w, r, &in) {
		return
	}
	t := clip(in.Text, 600)
	if t == "" || !a.allow("th:"+clientIP(r), 6) {
		writeErr(w, 400, "Write a theory (and avoid posting too quickly)")
		return
	}
	author := "Anonymous"
	uid := a.userID(r)
	a.st.mu.Lock()
	defer a.st.mu.Unlock()
	for _, u := range a.st.D.Users {
		if u.ID == uid && u.Name != "" {
			author = u.Name
		}
	}
	for i := range a.st.D.Mysteries {
		if a.st.D.Mysteries[i].ID == id {
			a.st.D.Mysteries[i].Theories = append(a.st.D.Mysteries[i].Theories, Theory{author, t})
			a.st.save()
			writeJSON(w, 200, a.st.D.Mysteries[i].Theories)
			return
		}
	}
	writeErr(w, 404, "Mystery not found")
}

func (a *App) submit(w http.ResponseWriter, r *http.Request) {
	var in struct {
		Title, Category, Desc, Body, Author, Website string
		Anonymous                                   bool
	}
	if !readJSON(w, r, &in) {
		return
	}
	if in.Website != "" { // honeypot: real people leave this empty
		writeJSON(w, 200, map[string]string{"status": "pending"})
		return
	}
	if !a.allow("sub:"+clientIP(r), 3) {
		writeErr(w, 429, "You can submit a few stories per minute. Try again shortly.")
		return
	}
	body := []string{}
	for _, p := range strings.Split(in.Body, "\n") {
		if p = clip(p, 2000); p != "" {
			body = append(body, p)
		}
	}
	title := clip(in.Title, 120)
	if title == "" || len(body) == 0 || len(strings.Join(body, " ")) < 200 {
		writeErr(w, 400, "Add a title and a story of at least 200 characters")
		return
	}
	author := clip(in.Author, 40)
	if in.Anonymous || author == "" {
		author = "Anonymous"
	}
	a.st.mu.Lock()
	defer a.st.mu.Unlock()
	a.st.D.NextID++
	a.st.D.Stories = append(a.st.D.Stories, Story{ID: a.st.D.NextID, Title: title, Category: clip(in.Category, 60), Author: author,
		Desc: clip(in.Desc, 300), Body: body, Minutes: len(strings.Fields(strings.Join(body, " ")))/200 + 1, Intensity: 3, Chapters: 1,
		Status: "pending", Created: time.Now().UTC().Format("2006-01-02"), Kind: "submission", Triggers: []int{50}})
	a.st.save()
	writeJSON(w, 200, map[string]string{"status": "pending"})
}

func (a *App) playVideos(w http.ResponseWriter, r *http.Request) {
	level := r.URL.Query().Get("level")
	a.st.mu.RLock()
	defer a.st.mu.RUnlock()
	out := []string{}
	for _, v := range a.st.D.Videos {
		if v.Enabled && v.OK && (level == "" || v.Level == level) {
			out = append(out, v.URL)
		}
	}
	writeJSON(w, 200, out)
}

func (a *App) me(w http.ResponseWriter, r *http.Request, id int) {
	a.st.mu.RLock()
	defer a.st.mu.RUnlock()
	for _, u := range a.st.D.Users {
		if u.ID == id {
			writeJSON(w, 200, u.pub())
			return
		}
	}
	writeErr(w, 404, "Account not found")
}

func (a *App) toggleBookmark(w http.ResponseWriter, r *http.Request, id int) {
	sid := pathID(r)
	a.st.mu.Lock()
	defer a.st.mu.Unlock()
	for i := range a.st.D.Users {
		u := &a.st.D.Users[i]
		if u.ID != id {
			continue
		}
		kept, found := []int{}, false
		for _, b := range u.Bookmarks {
			if b == sid {
				found = true
			} else {
				kept = append(kept, b)
			}
		}
		if !found {
			kept = append(kept, sid)
		}
		u.Bookmarks = kept
		a.st.save()
		writeJSON(w, 200, u.pub())
		return
	}
	writeErr(w, 404, "Account not found")
}

func (a *App) saveProgress(w http.ResponseWriter, r *http.Request, id int) {
	var in struct{ Pct int }
	if !readJSON(w, r, &in) {
		return
	}
	if in.Pct < 0 || in.Pct > 100 {
		writeErr(w, 400, "Progress must be 0 to 100")
		return
	}
	a.st.mu.Lock()
	defer a.st.mu.Unlock()
	for i := range a.st.D.Users {
		if a.st.D.Users[i].ID == id {
			if a.st.D.Users[i].Progress == nil {
				a.st.D.Users[i].Progress = map[string]int{}
			}
			a.st.D.Users[i].Progress[strconv.Itoa(pathID(r))] = in.Pct
			a.st.save()
			writeJSON(w, 200, map[string]string{"status": "saved"})
			return
		}
	}
	writeErr(w, 404, "Account not found")
}

func (a *App) stats(w http.ResponseWriter, r *http.Request) {
	a.st.mu.RLock()
	defer a.st.mu.RUnlock()
	st := map[string]int{"published": 0, "pending": 0, "draft": 0, "users": len(a.st.D.Users), "videosOk": 0}
	for _, s := range a.st.D.Stories {
		st[s.Status]++
	}
	for _, v := range a.st.D.Videos {
		if v.Enabled && v.OK {
			st["videosOk"]++
		}
	}
	writeJSON(w, 200, st)
}

func (a *App) queue(w http.ResponseWriter, r *http.Request) {
	a.st.mu.RLock()
	defer a.st.mu.RUnlock()
	out := []Story{}
	for _, s := range a.st.D.Stories {
		if s.Status == "pending" || s.Status == "draft" {
			out = append(out, s)
		}
	}
	writeJSON(w, 200, out)
}

func (a *App) setStatus(w http.ResponseWriter, r *http.Request) {
	var in struct{ Status string }
	if !readJSON(w, r, &in) {
		return
	}
	if in.Status != "published" && in.Status != "rejected" && in.Status != "draft" {
		writeErr(w, 400, "Status must be published, rejected or draft")
		return
	}
	id := pathID(r)
	a.st.mu.Lock()
	defer a.st.mu.Unlock()
	for i := range a.st.D.Stories {
		if a.st.D.Stories[i].ID == id {
			a.st.D.Stories[i].Status = in.Status
			a.st.save()
			writeJSON(w, 200, a.st.D.Stories[i])
			return
		}
	}
	writeErr(w, 404, "Story not found")
}

func (a *App) deleteStory(w http.ResponseWriter, r *http.Request) {
	id := pathID(r)
	a.st.mu.Lock()
	defer a.st.mu.Unlock()
	for i := range a.st.D.Stories {
		if a.st.D.Stories[i].ID == id {
			a.st.D.Stories = append(a.st.D.Stories[:i], a.st.D.Stories[i+1:]...)
			a.st.save()
			writeJSON(w, 200, map[string]string{"status": "deleted"})
			return
		}
	}
	writeErr(w, 404, "Story not found")
}

func (a *App) addMystery(w http.ResponseWriter, r *http.Request) {
	var in Mystery
	if !readJSON(w, r, &in) {
		return
	}
	if in.Title == "" || in.Date == "" {
		writeErr(w, 400, "Title and date (YYYY-MM-DD) are required")
		return
	}
	a.st.mu.Lock()
	defer a.st.mu.Unlock()
	a.st.D.NextID++
	in.ID, in.Theories = a.st.D.NextID, []Theory{}
	a.st.D.Mysteries = append(a.st.D.Mysteries, in)
	a.st.save()
	writeJSON(w, 200, in)
}
