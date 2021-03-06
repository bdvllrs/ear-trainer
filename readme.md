# Ear Trainer 🎵

## Install
Clone the project
```
git clone https://github.com/bdvllrs/ear-trainer.git && cd ear-trainer
```

### Icons
For the icons, download fontawesome and put in the project directory.

### Sound excerpt
The excerpt are generated by sampling from a collection of scores.
To generate the scores, you will need some midi files.

Add some midi files in the `midi` folder.
(You can for example get this dataset: https://www.kaggle.com/soumikrakshit/classical-music-midi)

Start python script
```
python make_file_list.py
```

This will generate a `scores.json` file containing all midi excerpt.

Once this file is generated, the midi files are no longer required
for the app to work.

## Soundfonts
The sound is generated using a soundfont from MIDI.js.
(https://github.com/mudcube/MIDI.js/blob/88d85c14165356d3fe26f84b30f2061676433da4/examples/soundfont/acoustic_grand_piano-ogg.js).

You can change the soundfont by updating the `soundfont.js` file.

## Credits
- [Tone.js](https://tonejs.github.io/) for sound generation.
- [Vexflow](https://www.vexflow.com/) for scores.
- [MIDI.js](https://github.com/mudcube/MIDI.js) for the soundfont.
- [PitchDetech](https://github.com/cwilso/PitchDetect) live audio recording code heavily inspired by this repository.
- [Pitchfinder](https://github.com/peterkhayes/pitchfinder) to detect played pitch. Using the Yin et al. algorithm.
