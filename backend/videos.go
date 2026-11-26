package main

import (
	"errors"
	"fmt"
	"net"
	"net/http"
	"net/url"
	"strings"
	"time"
)

// ---------- Jumpscare video manager ----------

func validateVideo(raw string) error {
	u, err := url.Parse(raw)
	if err != nil || u.Scheme != "https" || u.Host == "" {
		return errors.New("use an https URL")
	}
	p := strings.ToLower(u.Path)
	if !strings.HasSuffix(p, ".mp4") && !strings.HasSuffix(p, ".webm") {
		return errors.New("URL must end in .mp4 or .webm")
	}
	ips, err := net.LookupIP(u.Hostname())
	if err != nil || len(ips) == 0 {
		return errors.New("host does not resolve")
	}
	for _, ip := range ips {
		if ip.IsLoopback() || ip.IsPrivate() || ip.IsLinkLocalUnicast() || ip.IsUnspecified() {
			return errors.New("host is not a public address")
		}
	}
	c := &http.Client{Timeout: 6 * time.Second, CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }}
	resp, err := c.Head(raw)
	if err != nil {
		return errors.New("host could not be reached")
	}
	resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode > 299 {
		return fmt.Errorf("host answered %d", resp.StatusCode)
	}
	if !strings.HasPrefix(resp.Header.Get("Content-Type"), "video/") {
		return errors.New("host did not report a video content type")
	}
	return nil
}

func (a *App) adminVideos(w http.ResponseWriter, r *http.Request) {
	a.st.mu.RLock()
	defer a.st.mu.RUnlock()
	writeJSON(w, 200, a.st.D.Videos)
}

func (a *App) addVideo(w http.ResponseWriter, r *http.Request) {
	var in Video
	if !readJSON(w, r, &in) {
		return
	}
	in.URL = clip(in.URL, 500)
	if in.Level != "Mild" && in.Level != "Extreme" && in.Level != "Nightmare" {
		in.Level = "Mild"
	}
	err := validateVideo(in.URL)
	in.OK, in.Enabled, in.Checked = err == nil, err == nil, time.Now().UTC().Format(time.RFC3339)
	if err != nil {
		in.Error = err.Error()
	}
	in.Category = clip(in.Category, 40)
	a.st.mu.Lock()
	defer a.st.mu.Unlock()
	a.st.D.NextID++
	in.ID = a.st.D.NextID
	a.st.D.Videos = append(a.st.D.Videos, in)
	a.st.save()
	writeJSON(w, 200, in)
}

func (a *App) testVideo(w http.ResponseWriter, r *http.Request) {
	id := pathID(r)
	a.st.mu.RLock()
	raw := ""
	for _, v := range a.st.D.Videos {
		if v.ID == id {
			raw = v.URL
		}
	}
	a.st.mu.RUnlock()
	if raw == "" {
		writeErr(w, 404, "Video not found")
		return
	}
	err := validateVideo(raw)
	a.st.mu.Lock()
	defer a.st.mu.Unlock()
	for i := range a.st.D.Videos {
		if a.st.D.Videos[i].ID == id {
			v := &a.st.D.Videos[i]
			v.OK, v.Error, v.Checked = err == nil, "", time.Now().UTC().Format(time.RFC3339)
			if err != nil {
				v.Error = err.Error()
			}
			a.st.save()
			writeJSON(w, 200, v)
			return
		}
	}
}

func (a *App) patchVideo(w http.ResponseWriter, r *http.Request) {
	var in struct {
		Enabled  *bool
		Category *string
		Level    *string
	}
	if !readJSON(w, r, &in) {
		return
	}
	id := pathID(r)
	a.st.mu.Lock()
	defer a.st.mu.Unlock()
	for i := range a.st.D.Videos {
		if a.st.D.Videos[i].ID == id {
			v := &a.st.D.Videos[i]
			if in.Enabled != nil {
				v.Enabled = *in.Enabled
			}
			if in.Category != nil {
				v.Category = clip(*in.Category, 40)
			}
			if in.Level != nil && (*in.Level == "Mild" || *in.Level == "Extreme" || *in.Level == "Nightmare") {
				v.Level = *in.Level
			}
			a.st.save()
			writeJSON(w, 200, v)
			return
		}
	}
	writeErr(w, 404, "Video not found")
}

func (a *App) deleteVideo(w http.ResponseWriter, r *http.Request) {
	id := pathID(r)
	a.st.mu.Lock()
	defer a.st.mu.Unlock()
	for i := range a.st.D.Videos {
		if a.st.D.Videos[i].ID == id {
			a.st.D.Videos = append(a.st.D.Videos[:i], a.st.D.Videos[i+1:]...)
			a.st.save()
			writeJSON(w, 200, map[string]string{"status": "deleted"})
			return
		}
	}
	writeErr(w, 404, "Video not found")
}
