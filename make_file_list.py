import json
from pathlib import Path
import mido


def walk(path, ext=None):
    for file in path.iterdir():
        if file.is_dir():
            yield from walk(file, ext)
        elif ext is None or file.suffix[1:] in ext:
            yield file


if __name__ == "__main__":
    files = []
    midi_path = Path.cwd() / "midi"
    for midi_file_path in walk(midi_path, ['mid']):
        midi_file = mido.MidiFile(str(midi_file_path))
        song_notes = []
        for msg in midi_file:
            if msg.type == "note_on":
                song_notes.append(msg.note)
        files.append({
            "name": midi_file_path.stem,
            "notes": song_notes
        })

    with open(midi_path / "scores.json", "w") as midi_tunes:
        json.dump(files, midi_tunes)
