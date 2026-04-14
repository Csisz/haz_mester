import os
from pypdf import PdfWriter, PdfReader


def merge_pdfs(input_folder, output_file):
    writer = PdfWriter()
    pdf_files = []

    # Ellenőrizzük, hogy létezik-e a mappa
    if not os.path.exists(input_folder):
        print(f"[HIBA] Nem létezik a mappa: {input_folder}")
        return

    # PDF-ek gyűjtése
    for file in os.listdir(input_folder):
        if file.lower().endswith(".pdf"):
            full_path = os.path.join(input_folder, file)
            pdf_files.append(full_path)

    # Rendezés név szerint
    pdf_files.sort()

    if not pdf_files:
        print(f"[FIGYELEM] Nincs PDF a mappában: {input_folder}")
        return

    print(f"\n--- Feldolgozás: {input_folder} ---")

    # Egyesítés
    for pdf in pdf_files:
        try:
            print(f"Hozzáadás: {pdf}")
            reader = PdfReader(pdf)

            for page in reader.pages:
                writer.add_page(page)

        except Exception as e:
            print(f"[HIBA] Nem sikerült beolvasni: {pdf}")
            print(f"       {e}")

    # Mentés
    try:
        with open(output_file, "wb") as f:
            writer.write(f)
        print(f"\n[KÉSZ] Létrehozva: {output_file}")

    except Exception as e:
        print(f"[HIBA] Nem sikerült menteni: {output_file}")
        print(f"       {e}")


if __name__ == "__main__":
    # Mappák
    folder1 = r"D:\zugligeti\tartószerkezeti tervek\tartószerkezeti tervek"
    folder2 = r"D:\zugligeti\ÉPÜLETGÉPÉSZETI RAJZLISTA"

    # Kimeneti fájlok
    output1 = r"D:\zugligeti\tartószerkezeti_tervek.pdf"
    output2 = r"D:\zugligeti\gepeszeti_rajzok.pdf"

    print("PDF egyesítés indítása...")

    merge_pdfs(folder1, output1)   
    # merge_pdfs(folder2, output2)

    print("\nMinden feladat kész.")