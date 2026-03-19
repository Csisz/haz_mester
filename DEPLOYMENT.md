# Építész — Telepítési útmutató

## 🚀 Gyors telepítés (5 perc)

### Előfeltételek
- Docker & Docker Compose telepítve
- Anthropic API kulcs (https://console.anthropic.com)

### 1. Konfiguráció
```bash
cp .env.example .env
```

Szerkeszd a `.env` fájlt:
```
SECRET_KEY=<32+ karakteres véletlenszerű string>
ANTHROPIC_API_KEY=sk-ant-...
```

Secret key generálása:
```bash
python3 -c "import secrets; print(secrets.token_hex(32))"
```

### 2. Indítás
```bash
docker compose up -d --build
```

### 3. Ellenőrzés
```bash
# Logok megtekintése
docker compose logs -f

# Jelszavak megtalálása (első indításkor)
docker compose logs backend | grep -A 10 "GENERATED PASSWORDS"
```

Nyisd meg: **http://localhost**

---

## 🏠 Synology NAS telepítés

### Előkészítés
1. Nyisd meg: **DSM Control Panel → Task Scheduler → Create → Triggered Task → User-defined script**
2. Vagy használd a **Container Manager** alkalmazást (Docker)

### Container Manager (ajánlott)
1. **Container Manager** → **Project** → **Create**
2. Forrás: **Upload docker-compose.yml**
3. Töltsd fel a `docker-compose.yml` fájlt
4. Adj hozzá environment változókat a GUI-ban
5. Indítsd el

### SSH telepítés (haladó)
```bash
# SSH be a NAS-ba
ssh admin@192.168.1.x

# Fájlok másolása (a saját gépedről)
scp -r ./epitesz-app admin@192.168.1.x:/volume1/docker/epitesz/

# NAS-on
cd /volume1/docker/epitesz
cp .env.example .env
nano .env  # Töltsd ki az értékeket
docker compose up -d --build
```

### Külső elérés a NAS-on
1. **DSM Control Panel → External Access → Router Configuration** — nyisd meg a 80/443 portot
2. **DSM Control Panel → External Access → DDNS** — állíts be domain nevet
3. A `.env`-ben állítsd be: `CORS_ORIGINS=https://sajatdomain.synology.me`

---

## ☁️ Cloud telepítés (AWS/GCP/Azure)

### AWS EC2
```bash
# Ubuntu 22.04 LTS instance (t3.small vagy nagyobb)
sudo apt update && sudo apt install -y docker.io docker-compose-plugin

# Fájlok másolása
scp -i your-key.pem -r ./epitesz-app ubuntu@EC2_IP:~/

# EC2-n
cd ~/epitesz-app
cp .env.example .env
nano .env
sudo docker compose up -d --build
```

#### HTTPS SSL certifikát (Let's Encrypt)
```bash
# Telepítsd a Certbot-ot
sudo apt install certbot

# Generálj certifikátot
sudo certbot certonly --standalone -d your-domain.com

# Másold a certs-et
sudo cp /etc/letsencrypt/live/your-domain.com/fullchain.pem nginx/ssl/cert.pem
sudo cp /etc/letsencrypt/live/your-domain.com/privkey.pem nginx/ssl/key.pem

# HTTPS nginx config aktiválása
# Szerkeszd a nginx/nginx.conf-ot, kommenteld ki a HTTP redirect-et
```

---

## 🔧 Hasznosítható parancsok

```bash
# Indítás
docker compose up -d

# Leállítás
docker compose down

# Újraépítés (kód változás után)
docker compose up -d --build

# Logok
docker compose logs -f backend
docker compose logs -f frontend

# Adatbázis mentése
docker compose exec backend sqlite3 /app/data/epitesz.db .dump > backup_$(date +%Y%m%d).sql

# Adatbázis visszaállítása
cat backup_20240101.sql | docker compose exec -T backend sqlite3 /app/data/epitesz.db

# Jelszavak megtekintése (első indítás)
docker compose logs backend 2>&1 | grep -A 10 "GENERATED"

# Backend shell
docker compose exec backend bash

# Adatok törlése és újrainicializálás
docker compose down -v
docker compose up -d --build
```

---

## 👥 Kezdeti felhasználók

Az első indításkor ezek a felhasználók jönnek létre:

| Felhasználónév | Teljes név | Szerepkör |
|---|---|---|
| viktor | Huszár Viktor | **Admin** |
| csenge | dr. Huszár-Kőszegi Klára Csenge | Standard |
| agi | Ocskay-Kőszegi Ágnes Emese | Standard |
| laci | Ocskay László | Standard |
| gabor | Gábor | Standard |

**Az első belépéskor mindenki jelszót köteles változtatni.**

A generált jelszavak a backend log-ban találhatók:
```bash
docker compose logs backend | grep -A 10 "GENERATED PASSWORDS"
```

---

## 🔒 Biztonsági checklist éles üzemhez

- [ ] `SECRET_KEY` cseréje véletlenszerű értékre
- [ ] HTTPS beállítása
- [ ] `CORS_ORIGINS` beállítása a valós domainre
- [ ] Tűzfal: csak 80 és 443 port nyitva
- [ ] Rendszeres adatbázis mentés
- [ ] Anthropic API kulcs rotálása

---

## 🐛 Hibaelhárítás

**Backend nem indul:**
```bash
docker compose logs backend
# Ellenőrizd a .env fájlt, főleg a DATABASE_URL-t
```

**AI nem működik:**
```bash
# Ellenőrizd az API kulcsot
docker compose exec backend env | grep ANTHROPIC
```

**Nem tölthető fel fájl:**
```bash
# Ellenőrizd az nginx client_max_body_size értékét (nginx/nginx.conf)
```

**Adatbázis hiba:**
```bash
# SQLite jogosultság probléma
docker compose exec backend ls -la /app/data/
```
