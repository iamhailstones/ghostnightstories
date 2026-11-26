package main

import (
	_ "embed"
	"encoding/json"
	"log"
	"os"
	"sync"
	"time"
)

//go:embed seed.json
var seedJSON []byte

type StoryChapter struct {
	Title string   `json:"title"`
	Body  []string `json:"body"`
}

type Story struct {
	ID          int            `json:"id"`
	Title       string         `json:"title"`
	Category    string         `json:"category"`
	Author      string         `json:"author"`
	Desc        string         `json:"desc"`
	Body        []string       `json:"body"`
	ChapterData []StoryChapter `json:"chapterData,omitempty"`
	Minutes     int            `json:"minutes"`
	Intensity   int            `json:"intensity"`
	Chapters    int            `json:"chapters"`
	Cover       string         `json:"cover"`
	Status      string         `json:"status"` // published | pending | draft | rejected
	Created     string         `json:"created"`
	Kind        string         `json:"kind"` // story | submission | ai
	Triggers    []int          `json:"triggers"`
	Reports     int            `json:"reports"`
}
type Opt struct {
	Label string `json:"label"`
	To    string `json:"to"`
}
type Node struct {
	Text    string `json:"text"`
	Options []Opt  `json:"options"`
	Ending  bool   `json:"ending"`
}
type Interactive struct {
	ID    int             `json:"id"`
	Name  string          `json:"name"`
	Start string          `json:"start"`
	Nodes map[string]Node `json:"nodes"`
}
type Theory struct {
	Author string `json:"author"`
	Text   string `json:"text"`
}
type Mystery struct {
	ID       int      `json:"id"`
	Title    string   `json:"title"`
	Body     string   `json:"body"`
	Clues    string   `json:"clues"`
	Theories []Theory `json:"theories"`
	Reveal   string   `json:"reveal"`
	Date     string   `json:"date"`
	Day      int      `json:"day"`
}
type Case struct {
	ID       int    `json:"id"`
	Code     string `json:"code"`
	Location string `json:"location"`
	Date     string `json:"date"`
	Level    string `json:"level"`
	Evidence string `json:"evidence"`
	Witness  string `json:"witness"`
	Notes    string `json:"notes"`
	Status   string `json:"status"`
}
type Video struct {
	ID       int    `json:"id"`
	URL      string `json:"url"`
	Category string `json:"category"`
	Level    string `json:"level"` // Mild | Extreme | Nightmare
	Enabled  bool   `json:"enabled"`
	OK       bool   `json:"ok"`
	Checked  string `json:"checked"`
	Error    string `json:"error"`
}
type User struct {
	ID        int            `json:"id"`
	Email     string         `json:"email"`
	Name      string         `json:"name"`
	Hash      string         `json:"hash"`
	Salt      string         `json:"salt"`
	Role      string         `json:"role"`
	Bookmarks []int          `json:"bookmarks"`
	Progress  map[string]int `json:"progress"`
}
type PubUser struct {
	ID        int            `json:"id"`
	Email     string         `json:"email"`
	Name      string         `json:"name"`
	Role      string         `json:"role"`
	Bookmarks []int          `json:"bookmarks"`
	Progress  map[string]int `json:"progress"`
}

func (u User) pub() PubUser {
	return PubUser{u.ID, u.Email, u.Name, u.Role, u.Bookmarks, u.Progress}
}

type Data struct {
	Stories     []Story       `json:"stories"`
	Interactive []Interactive `json:"interactive"`
	Mysteries   []Mystery     `json:"mysteries"`
	Archive     []Case        `json:"archive"`
	Users       []User        `json:"users"`
	Videos      []Video       `json:"videos"`
	NextID      int           `json:"nextId"`
}

type Store struct {
	mu   sync.RWMutex
	path string
	D    Data
}

func NewStore(path string) *Store {
	s := &Store{path: path}
	if b, err := os.ReadFile(path); err == nil {
		if err := json.Unmarshal(b, &s.D); err != nil {
			log.Fatal("cannot read data file: ", err)
		}
		return s
	}
	if err := json.Unmarshal(seedJSON, &s.D); err != nil {
		log.Fatal("bad seed: ", err)
	}
	s.D.NextID = 100
	for i := range s.D.Mysteries {
		s.D.Mysteries[i].Date = time.Now().UTC().AddDate(0, 0, s.D.Mysteries[i].Day).Format("2006-01-02")
	}
	s.save()
	return s
}

// save writes the data file. Callers must hold the write lock (or be single-threaded at startup).
func (s *Store) save() {
	b, _ := json.MarshalIndent(s.D, "", " ")
	tmp := s.path + ".tmp"
	if err := os.WriteFile(tmp, b, 0o600); err == nil {
		os.Rename(tmp, s.path)
	} else {
		log.Println("save failed:", err)
	}
}

func (s *Store) EnsureAdmin(email, pw string) {
	if email == "" || pw == "" {
		log.Println("ADMIN_EMAIL / ADMIN_PASSWORD not set: no admin account created")
		return
	}
	s.mu.Lock()
	defer s.mu.Unlock()

	for i, u := range s.D.Users {
		if u.Email == email {
			h, salt := hashPW(pw)
			s.D.Users[i].Hash = h
			s.D.Users[i].Salt = salt
			s.D.Users[i].Role = "admin"
			s.save()
			log.Println("Admin account synchronized successfully")
			return
		}
	}

	h, salt := hashPW(pw)
	s.D.NextID++
	s.D.Users = append(s.D.Users, User{
		ID:        s.D.NextID,
		Email:     email,
		Name:      "Admin",
		Hash:      h,
		Salt:      salt,
		Role:      "admin",
		Bookmarks: []int{},
		Progress:  map[string]int{},
	})
	s.save()
}
