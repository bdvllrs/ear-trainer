const localStorage =  window.localStorage;
const nextMusic = document.getElementById('next');
const replayMusic = document.getElementById('replay');
const noteHolder = document.getElementById("notes");
const revealAnswerElement = document.getElementById("reveal-answer");
const numberNoteInput = document.getElementById("number-notes");
const transcriptElement = document.getElementById("transcript");
const showFirstNoteInput = document.getElementById("show-first-notes");
const lowestNoteInput = document.getElementById("lowest-note");
const highestNoteInput = document.getElementById("highest-note");
const transposeInput = document.getElementById("transpose");
let showFirstNote = showFirstNoteInput.checked;
let showSolution = false;
let numberNotes = parseInt(numberNoteInput.value);
let currentNote = 0;
let playing = false;
let highestNote = highestNoteInput.value;
let lowestNote = lowestNoteInput.value;
let transposeInstrument = transposeInput.value;
let player;
let availableFiles;
let noteBullets = [];

let generatedScore = [];

let midiLoaded = false;

if (showFirstNote) {
    transcriptElement.classList.remove("hidden");
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Load settings from local storage.
if (localStorage.getItem("transpose")) {
    transposeInstrument = localStorage.getItem("transpose");
    transposeInput.value = transposeInstrument;
}

if (localStorage.getItem("lowest-note")) {
    lowestNote = localStorage.getItem("lowest-note");
    lowestNoteInput.value = lowestNote;
}

if (localStorage.getItem("highest-note")) {
    highestNote = localStorage.getItem("highest-note");
    highestNoteInput.value = highestNote;
}


numberNoteInput.addEventListener("change", async function (e) {
    numberNotes = parseInt(e.target.value);

    resetNoteBullets();

    if (noteBullets && noteBullets.length > numberNotes) {
        let toRemove = noteBullets.length - numberNotes;
        for (let k = 0; k < toRemove; k++) {
            let removedChild = noteBullets.pop();
            noteHolder.removeChild(removedChild);
        }
    }
    if (noteBullets && noteBullets.length < numberNotes) {
        let toAdd = numberNotes - noteBullets.length;
        for (let k = 0; k < toAdd; k++) {
            let li = document.createElement("li");
            noteHolder.appendChild(li);
            noteBullets.push(li);
        }
    }

    showSolution = false;
    await loadMIDIFile()
});

showFirstNoteInput.addEventListener("change", function (e) {
    showFirstNote = e.target.checked;
    if (showFirstNote) {
        transcriptElement.classList.remove("hidden")
    } else {
        transcriptElement.classList.add("hidden")
    }
});

lowestNoteInput.addEventListener("change", function (e) {
    lowestNote = e.target.value;
    localStorage.setItem("lowest-note", lowestNote);
});

highestNoteInput.addEventListener("change", function (e) {
    highestNote = e.target.value;
    localStorage.setItem("highest-note", highestNote);
});

transposeInput.addEventListener("change", function (e) {
    if (Object.keys(MIDI.keyToNote).includes(e.target.value + '4')){
        transposeInstrument = e.target.value;
        localStorage.setItem("transpose", transposeInstrument);
    }
});

revealAnswerElement.addEventListener("click", function (e) {
    showSolution = !showSolution;

    if (!showFirstNote && showSolution)
        transcriptElement.classList.remove("hidden");
    else if (!showFirstNote && !showSolution)
        transcriptElement.classList.add("hidden");

    if (generatedScore.length) {
        drawScore(generatedScore);
    }
});

const resetNoteBullets = function () {
    if (noteBullets) {
        noteBullets.forEach(function (bullet) {
            bullet.classList.remove("active");
        })
    }
}

const getAvailableFiles = async function () {
    const jsonFile = await fetch("midi/midi_files.json");
    availableFiles = await jsonFile.json();
}

const sample = function (list) {
    return list[Math.floor(Math.random() * list.length)];
}

const transpose = function (notes) {
    const concertPitch = MIDI.keyToNote['C4'];
    const transposePitch = MIDI.keyToNote[transposeInstrument + "3"];
    const difference = concertPitch - transposePitch;
    return notes.map(function (note) {
        return MIDI.noteToKey[MIDI.keyToNote[note] + difference];
    })
}

const loadMIDIFile = async function () {
    if (!availableFiles) {
        await getAvailableFiles();
    }

    const fileURL = sample(availableFiles);

    midiLoaded = false;
    replayMusic.classList.add('loading')
    player.loadFile("midi/" + fileURL, function () {

        let score = [];


        player.data.forEach(function (data) {
            data.forEach(function (event) {
                if (event['event'] && event['event']['type'] === "channel" &&
                    event['event']['subtype'] === "noteOn") {
                    score.push(MIDI.noteToKey[event['event']['noteNumber']])
                }
            });
        });

        let validTune = false;

        // FIXME: can be infinite loop...
        while(!validTune) {
            const musicStart = Math.floor(Math.random() * (score.length - numberNotes));
            generatedScore = score.slice(musicStart, musicStart + numberNotes);
            validTune = true;
            const transposedTune = transpose(generatedScore);
            for (let k = 0; k < generatedScore.length; k++) {
                if (MIDI.keyToNote[transposedTune[k]] < MIDI.keyToNote[lowestNote]
                    || MIDI.keyToNote[transposedTune[k]] > MIDI.keyToNote[highestNote]) {
                    validTune = false;
                }
            }
        }

        if (showFirstNote) {
            drawScore(generatedScore);
        }

        midiLoaded = true;
        replayMusic.classList.remove('loading')
    }, null, function (e) {
        console.log(e)
    });
};

const counterListener = function (data) {
    noteBullets[numberNotes - 1].classList.remove('active');
    noteBullets[currentNote].classList.add('active');
    if (currentNote > 0) {
        noteBullets[currentNote - 1].classList.remove('active');
    }
    currentNote++;
    if (currentNote >= numberNotes) {
        currentNote = 0;
        player.removeListener();
        player.stop();
        player.addListener(counterListener)
    }
};

const addNoteElements = function () {
    // Remove current elements
    while (noteHolder.firstChild) noteHolder.removeChild(noteHolder.firstChild);
    // Add the new ones.
    for (let k = 0; k < numberNotes; k++) {
        let li = document.createElement("li");
        noteHolder.appendChild(li);
        noteBullets.push(li);
    }
};

const drawScore = function (notes) {
    transcriptElement.innerHTML = "";

    if (notes.length) {
        VF = Vex.Flow;

        // Create an SVG renderer and attach it to the DIV element named "boo".
        let renderer = new VF.Renderer(transcriptElement, VF.Renderer.Backends.SVG);
        // Size our SVG:
        renderer.resize(800, 200);
        // And get a drawing context:
        let context = renderer.getContext();

        // Create a stave at position 10, 40 of width 400 on the canvas.
        let stave = new VF.Stave(10, 40, 700);

        // Add a clef and time signature.
        stave.addClef("treble");

        // Connect it to the rendering context and draw!
        stave.setContext(context).draw();

        if (!showSolution) {
            notes = notes.slice(0, 1);
        }

        console.log(notes);
        notes = transpose(notes);
        console.log(notes);

        notes = notes.map(function (note) {
            const n = note.slice(0, -1) + "/" + note.slice(-1);
            let staveNote = new VF.StaveNote({clef: "treble", keys: [n], duration: "q"})
            if (note.slice(1, 2) === "#") {
                staveNote = staveNote.addAccidental(0, new VF.Accidental("#"));
            } else if (note.slice(1, 2) === "b") {
                staveNote = staveNote.addAccidental(0, new VF.Accidental("b"));
            }
            return staveNote;
        });

        // Create a voice in 4/4 and add the notes from above
        let voice = new VF.Voice({num_beats: notes.length, beat_value: 4});
        voice.addTickables(notes);

        // Format and justify the notes to 400 pixels.
        let formatter = new VF.Formatter().joinVoices([voice]).format([voice], 400);

        // Render voice
        voice.draw(context, stave);
    }
}

const generateRandomExcerpt = function () {
    let notes = [];
    let possibleNotes = [];

    for (let [key, note] of Object.entries(MIDI.noteToKey)) {

        if (key >= MIDI.keyToNote[lowestNote] && key <= MIDI.keyToNote[highestNote]) {
            possibleNotes.push(note)
        }
    }

    for (let k = 0; k < numberNotes; k++) {
        let item = Math.floor(Math.random() * possibleNotes.length);
        notes.push(possibleNotes[item]);
    }

    return notes;
};

const playExcerpt = async function () {
    MIDI.setVolume(0, 127);
    playing = true;
    for (let k = 0; k < generatedScore.length; k++) {
        let note = MIDI.keyToNote[generatedScore[k]]
        noteBullets[k].classList.add('active');
        MIDI.noteOn(0, note, 127, 0);
        MIDI.noteOff(0, note, 0.75);
        await sleep(1000);
        noteBullets[k].classList.remove('active');
    }
    playing = false;
}

window.onload = function () {
    MIDI.loadPlugin({
        soundfontUrl: "./soundfont/",
        instrument: "acoustic_grand_piano", // or the instrument code 1 (aka the default)
        onprogress: function (state, progress) {
            console.log(state, progress);
        },
        onsuccess: async function () {
            console.log("success")

            player = MIDI.Player;

            player.addListener(counterListener);
            nextMusic.classList.remove('loading')

            addNoteElements();

            await loadMIDIFile()

            nextMusic.addEventListener("click", async function (e) {
                showSolution = false;
                revealAnswerElement.classList.add('loading')
                await loadMIDIFile()
            });

            replayMusic.addEventListener("click", async function (e) {
                if (!playing) {
                    await playExcerpt()
                    revealAnswerElement.classList.remove('loading')
                }
            });
        }
    });
}


