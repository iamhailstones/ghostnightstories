package main

import (
	"crypto/rand"
	"encoding/hex"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"
)

func uploadDir() string { return env("UPLOAD_DIR", "uploads") }

func (a *App) allStories(w http.ResponseWriter, r *http.Request) {
	a.st.mu.RLock()
	defer a.st.mu.RUnlock()
	writeJSON(w, 200, a.st.D.Stories)
}

// cleanStory validates and normalises an editor payload. It returns an error message or "".
func cleanStory(in *Story) string {
	in.Title = clip(in.Title, 120)
	in.Category = clip(in.Category, 60)
	in.Author = clip(in.Author, 60)
	in.Desc = clip(in.Desc, 300)
	in.Cover = clip(in.Cover, 300)

	if in.Title == "" {
		return "A title is required"
	}

	// Convert older stories into a single chapter automatically.
	if len(in.ChapterData) == 0 {
		in.ChapterData = []StoryChapter{{
			Title: "Chapter 1",
			Body:  in.Body,
		}}
	}

	cleanChapters := make([]StoryChapter, 0, len(in.ChapterData))
	allBody := []string{}

	for i, chapter := range in.ChapterData {
		title := clip(chapter.Title, 120)
		if title == "" {
			title = "Chapter " + strconv.Itoa(i+1)
		}

		paragraphs := []string{}
		for _, paragraph := range chapter.Body {
			paragraph = clip(paragraph, 5000)
			if paragraph != "" {
				paragraphs = append(paragraphs, paragraph)
			}
		}

		if len(paragraphs) == 0 {
			return "Chapter " + strconv.Itoa(i+1) + " needs story text"
		}

		cleanChapters = append(cleanChapters, StoryChapter{
			Title: title,
			Body:  paragraphs,
		})
		allBody = append(allBody, paragraphs...)
	}

	if len(cleanChapters) == 0 {
		return "Add at least one chapter"
	}

	in.ChapterData = cleanChapters
	in.Body = allBody
	in.Chapters = len(cleanChapters)

	if in.Cover != "" &&
		!strings.HasPrefix(in.Cover, "/covers/") &&
		!strings.HasPrefix(in.Cover, "/uploads/") &&
		!strings.HasPrefix(in.Cover, "https://") {
		return "Cover must be an uploaded image or an https link"
	}
	if strings.Contains(in.Cover, "..") {
		return "Invalid cover path"
	}
	if in.Intensity < 1 || in.Intensity > 5 {
		in.Intensity = 3
	}
	if in.Minutes < 1 {
		in.Minutes = len(strings.Fields(strings.Join(allBody, " ")))/200 + 1
	}

	tr := []int{}
	for _, t := range in.Triggers {
		if t >= 0 && t <= 100 && len(tr) < 10 {
			tr = append(tr, t)
		}
	}
	in.Triggers = tr

	switch in.Status {
	case "published", "draft", "pending", "rejected":
	default:
		in.Status = "draft"
	}

	return ""
}

func (a *App) createStory(w http.ResponseWriter, r *http.Request) {
	var in Story
	if !readJSON(w, r, &in) {
		return
	}
	if msg := cleanStory(&in); msg != "" {
		writeErr(w, 400, msg)
		return
	}
	a.st.mu.Lock()
	defer a.st.mu.Unlock()
	a.st.D.NextID++
	in.ID, in.Kind, in.Reports = a.st.D.NextID, "story", 0
	in.Created = time.Now().UTC().Format("2006-01-02")
	a.st.D.Stories = append(a.st.D.Stories, in)
	a.st.save()
	writeJSON(w, 200, in)
}

func (a *App) updateStory(w http.ResponseWriter, r *http.Request) {
	id := pathID(r)
	var in Story
	if !readJSON(w, r, &in) {
		return
	}
	if msg := cleanStory(&in); msg != "" {
		writeErr(w, 400, msg)
		return
	}
	a.st.mu.Lock()
	defer a.st.mu.Unlock()
	for i := range a.st.D.Stories {
		old := a.st.D.Stories[i]
		if old.ID == id {
			in.ID, in.Created, in.Kind, in.Reports = old.ID, old.Created, old.Kind, old.Reports
			a.st.D.Stories[i] = in
			a.st.save()
			writeJSON(w, 200, in)
			return
		}
	}
	writeErr(w, 404, "Story not found")
}

// upload stores a cover image (jpeg, png or webp, max 5 MB) and returns its public path.
func (a *App) upload(w http.ResponseWriter, r *http.Request) {
	if err := r.ParseMultipartForm(5 << 20); err != nil {
		writeErr(w, 400, "Upload failed or file is larger than 5 MB")
		return
	}
	f, _, err := r.FormFile("file")
	if err != nil {
		writeErr(w, 400, "Choose an image file")
		return
	}
	defer f.Close()
	head := make([]byte, 512)
	n, _ := f.Read(head)
	ext := map[string]string{"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp"}[http.DetectContentType(head[:n])]
	if ext == "" {
		writeErr(w, 400, "Only JPEG, PNG or WebP images are allowed")
		return
	}
	if _, err := f.Seek(0, io.SeekStart); err != nil {
		writeErr(w, 500, "Could not read the file")
		return
	}
	rnd := make([]byte, 8)
	rand.Read(rnd)
	name := hex.EncodeToString(rnd) + ext
	if err := os.MkdirAll(uploadDir(), 0o755); err != nil {
		writeErr(w, 500, "Upload folder is not writable")
		return
	}
	dst, err := os.Create(filepath.Join(uploadDir(), name))
	if err != nil {
		writeErr(w, 500, "Could not save the file")
		return
	}
	defer dst.Close()
	if _, err := io.Copy(dst, f); err != nil {
		writeErr(w, 500, "Could not save the file")
		return
	}
	writeJSON(w, 200, map[string]string{"url": "/uploads/" + name})
}

func (a *App) serveUpload(w http.ResponseWriter, r *http.Request) {
	name := filepath.Base(r.PathValue("name"))
	w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
	http.ServeFile(w, r, filepath.Join(uploadDir(), name))
}
