import json
from pathlib import Path


if __name__ == "__main__":
    files = []
    current_path = Path(__file__).parent / "midi"
    for folder in current_path.iterdir():
        if folder.is_dir():
            for file in folder.iterdir():
                files.append(str(file))

    with open('midi/midi_files.json', 'w') as f:
        json.dump(files, f)
