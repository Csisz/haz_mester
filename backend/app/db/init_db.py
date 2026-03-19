import secrets
import string
from sqlalchemy.orm import Session
from app.db.database import SessionLocal
from app.core.security import get_password_hash

def generate_password(length=12):
    alphabet = string.ascii_letters + string.digits + "!@#$%"
    return ''.join(secrets.choice(alphabet) for _ in range(length))

INITIAL_USERS = [
    {"username": "viktor", "full_name": "Huszár Viktor", "email": "viktor@zugligeti.hu", "role": "admin"},
    {"username": "csenge", "full_name": "dr. Huszár-Kőszegi Klára Csenge", "email": "csenge@zugligeti.hu", "role": "standard"},
    {"username": "agi", "full_name": "Ocskay-Kőszegi Ágnes Emese", "email": "agi@zugligeti.hu", "role": "standard"},
    {"username": "laci", "full_name": "Ocskay László", "email": "laci@zugligeti.hu", "role": "standard"},
    {"username": "gabor", "full_name": "Gábor", "email": "gabor@zugligeti.hu", "role": "standard"},
]

INITIAL_PROJECT = {
    "name": "Zugligeti út 44/A - Épület felújítás",
    "description": "Kétlakásos ikerház felújítás és bővítés. 1121 Budapest, Zugligeti út 44/A. (10761/60 hrsz.)\n\nAz épület egy 4 szintes (pince, földszint, emelet, tetőtér) kétlakásos ikerház. Tervező: Galambos Péter okl. építészmérnök (BÉK É 01-6171). A tervek 2023 májusából valók.\n\nJelenleg zajló munkák:\n- Esztrich beton elkészült\n- Fűtés/hűtés panelrendszer szerelés folyamatban\n- Ablakok beépítve\n- Tetőterasz vízszigetelés felújítás szükséges",
    "status": "active",
    "type": "shared",
    "address": "1121 Budapest, Zugligeti út 44/A.",
    "hrsz": "10761/60",
    "total_area": 442.17,
    "floors": "Pinceszint (57,16 m²) + Földszint (167,37 m²) + Emelet (161,12 m²) + Tetőtér (56,52 m²)",
}

INITIAL_TASKS = [
    {
        "title": "Tetőterasz vízszigetelés - 1. lakrész",
        "description": "A tetőterasz lebontásra került a vasbeton lemez szintjéig. Teljes újjáépítés szükséges vízszigetelési réteggel.\n\n**Szükséges rétegrend (alulról felfelé):**\n1. VB lemez felület előkészítés, primer bevonat\n2. Bitumenes alapozó réteg (ELASTODECK B alapozó)\n3. 1. SBS bitumenes lemez (ELASTODECK B 40/P fólia, 4mm)\n4. 2. SBS bitumenes lemez (ELASTODECK B 40/P+V fólia, 4mm polimer)\n5. XPS hőszigetelés 10 cm (fordított tetőterasz)\n6. Geotextília szeparáló réteg\n7. Zúzottkő terhelőréteg 6-32 mm, 8-10 cm\n8. Térkő burkolat (egyedi kötőelemes rend.)\n\n**Megjegyzés:** A szomszédos lakrész terasza is érintett, egyeztetés szükséges!",
        "status": "in_progress",
        "priority": "critical",
        "category": "waterproofing",
        "estimated_cost": 2800000,
        "unit": "1. lakrész tetőterasz (13,60 m²)",
    },
    {
        "title": "Tetőterasz vízszigetelés - 2. lakrész",
        "description": "A 2. lakrész tetőterasza szintén érintett a beázási problémától. Ugyanolyan rétegrend szükséges mint az 1. lakrésznél.",
        "status": "pending",
        "priority": "critical",
        "category": "waterproofing",
        "estimated_cost": 2800000,
        "unit": "2. lakrész tetőterasz (13,60 m²)",
    },
    {
        "title": "NGBS fűtés/hűtés panel rendszer - Földszint",
        "description": "NGBS álmennyezeti fűtő-hűtő panelek felszerelése a földszinten. Tkf=38/30°C fűtés, 16/19°C hűtés.\n\nKörök:\n- PF-101: Ø16x2,0 NGBS Pe-Xa, l=90,44m, Q=1663W\n- PF-102: Ø16x2,0 NGBS Pe-Xa, l=77,64m, Q=2062W\n- PF-103: Ø16x2,0 NGBS Pe-Xa, l=71,12m, Q=1570W\n- PF-201: Ø16x2,0 NGBS Pe-Xa, l=97,88m, Q=1834W\n- PF-202: Ø16x2,0 NGBS Pe-Xa, l=70,54m, Q=1834W\n- PF-203: Ø16x2,0 NGBS Pe-Xa, l=62,46m, Q=1438W",
        "status": "in_progress",
        "priority": "high",
        "category": "hvac",
        "estimated_cost": 1800000,
        "unit": "Földszint mindkét lakás",
    },
    {
        "title": "NGBS fűtés/hűtés panel rendszer - Emelet",
        "description": "Emeleti fűtés/hűtés panelek NGBS rendszer szerint. Körök: PF-111-114 (1. lakrész), PF-211-214 (2. lakrész).",
        "status": "pending",
        "priority": "high",
        "category": "hvac",
        "estimated_cost": 1600000,
        "unit": "Emelet mindkét lakás",
    },
    {
        "title": "Beltéri ajtók beépítése - 1. lakrész",
        "description": "Az összes beltéri ajtó beépítése az 1. lakrészben. Az ajtók méretei az építészeti terveken szerepelnek (É-02 rajz alapján).\n\nFőbb ajtók:\n- Előszoba → Szoba: pm 85, 1,50×2,05\n- Fürdőszoba: pm 85, 1,50×(különböző)\n- Konyha-étkező: pm 85, 1,50×1,35\n\nAnyag: műanyag vagy fa (beruházóval egyeztetni)",
        "status": "pending",
        "priority": "medium",
        "category": "carpentry",
        "estimated_cost": 900000,
        "unit": "1. lakrész összes ajtó",
    },
    {
        "title": "Beltéri ajtók beépítése - 2. lakrész",
        "description": "Az összes beltéri ajtó beépítése a 2. lakrészben.",
        "status": "pending",
        "priority": "medium",
        "category": "carpentry",
        "estimated_cost": 950000,
        "unit": "2. lakrész összes ajtó",
    },
    {
        "title": "Homlokzat hőszigetelés - EPS",
        "description": "Homlokzati EPS hőszigetelés felszerelése az anyagjelölések szerint. Törtfehér vakolt felület, lábazati mészkő burkolat.",
        "status": "pending",
        "priority": "medium",
        "category": "insulation",
        "estimated_cost": 3500000,
        "unit": "Összes homlokzat (408,32 m²)",
    },
    {
        "title": "Fürdőszoba radiátorok beépítése",
        "description": "Vogel&Noot DELLA fürdőszoba radiátorok beépítése elektromos fűtőpatronnal (Q=600W).\n\nHelyszínek:\n- 1. lakrész földszinti fürdő: DELLA 1800×400\n- 1. lakrész emeleti fürdő: DELLA 1800×600\n- 2. lakrész összes fürdő: DELLA 1800×600",
        "status": "pending",
        "priority": "medium",
        "category": "hvac",
        "estimated_cost": 350000,
        "unit": "4 radiátor összesen",
    },
]

def init_db():
    from app.models.user import User
    from app.models.project import Project
    from app.models.task import Task
    from app.models.project_member import ProjectMember
    
    db = SessionLocal()
    try:
        # Check if already initialized
        if db.query(User).count() > 0:
            return
        
        print("Initializing database with default data...")
        
        # Create users
        users = []
        passwords = {}
        for user_data in INITIAL_USERS:
            pwd = generate_password()
            passwords[user_data["username"]] = pwd
            user = User(
                username=user_data["username"],
                full_name=user_data["full_name"],
                email=user_data["email"],
                role=user_data["role"],
                hashed_password=get_password_hash(pwd),
                is_active=True,
                must_change_password=True,
            )
            db.add(user)
        db.commit()
        
        # Print generated passwords
        print("\n" + "="*60)
        print("GENERATED PASSWORDS (save these!):")
        print("="*60)
        for username, pwd in passwords.items():
            print(f"  {username}: {pwd}")
        print("="*60 + "\n")
        
        # Refresh users
        users = db.query(User).all()
        viktor = next(u for u in users if u.username == "viktor")
        
        # Create main project
        project = Project(
            name=INITIAL_PROJECT["name"],
            description=INITIAL_PROJECT["description"],
            status=INITIAL_PROJECT["status"],
            type=INITIAL_PROJECT["type"],
            address=INITIAL_PROJECT["address"],
            hrsz=INITIAL_PROJECT["hrsz"],
            total_area=INITIAL_PROJECT["total_area"],
            floors=INITIAL_PROJECT["floors"],
            created_by=viktor.id,
        )
        db.add(project)
        db.commit()
        db.refresh(project)
        
        # Add all users as project members
        for user in users:
            member = ProjectMember(
                project_id=project.id,
                user_id=user.id,
                can_edit=True,
            )
            db.add(member)
        db.commit()
        
        # Create initial tasks
        for task_data in INITIAL_TASKS:
            task = Task(
                project_id=project.id,
                title=task_data["title"],
                description=task_data["description"],
                status=task_data["status"],
                priority=task_data["priority"],
                category=task_data["category"],
                estimated_cost=task_data["estimated_cost"],
                unit=task_data["unit"],
                created_by=viktor.id,
            )
            db.add(task)
        db.commit()
        
        print("Database initialized successfully!")
        
    except Exception as e:
        print(f"Error initializing database: {e}")
        db.rollback()
    finally:
        db.close()
