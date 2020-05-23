const localStorage = window.localStorage;
// DOM elements
const nextMusicButton = document.getElementById('next');
const replayMusicButton = document.getElementById('replay');
const solutionButton = document.getElementById("reveal-answer");
const notesElement = document.getElementById("notes");
const transcriptElement = document.getElementById("transcript");
const showFirstNoteInput = document.getElementById("show-first-notes");
const numberNoteInput = document.getElementById("number-notes");
const lowestNoteInput = document.getElementById("lowest-note");
const highestNoteInput = document.getElementById("highest-note");
const transposeInput = document.getElementById("transpose");

let showFirstNote = showFirstNoteInput.checked;
let showSolution = false;
let numberNotes = parseInt(numberNoteInput.value);
let playing = false;
let highestNote = highestNoteInput.value;
let lowestNote = lowestNoteInput.value;
let transposeInstrument = transposeInput.value;
let noteBullets = [];
let scores;

const {keyToNote, noteToKey} = makeKeyToNote();

const synth = new Tone.Sampler(Soundfont, function () {
    // Get the scores
    fetch("midi/scores.json")
        .then(async function (resp) {
            scores = await resp.json();
            console.log("Tunes fetched.");

            nextMusicButton.classList.remove('loading')
            addNoteElements();
            generateScore();
        })
        .catch(function (err) {
            console.log(err);
        });
}).toMaster();


let generatedScore = [];

let midiLoaded = false;

if (showFirstNote) {
    transcriptElement.classList.remove("hidden");
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function makeKeyToNote() {
    let keyToNote = {
        "A0": 21, "Bb0": 22, "B0": 23, "C8": 108
    };
    let noteToKey = {
        21: "A0", 22: "Bb0", 23: "B0", 108: "C8"
    };
    const notes = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];
    let curNote = 24;
    for (let k = 0; k <= 7; k++) {
        notes.forEach(function (note) {
            keyToNote[note + k.toString()] = curNote;
            noteToKey[curNote] = note + k.toString();
            curNote++;
        });
    }
    return {keyToNote, noteToKey};
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
            notesElement.removeChild(removedChild);
        }
    }
    if (noteBullets && noteBullets.length < numberNotes) {
        let toAdd = numberNotes - noteBullets.length;
        for (let k = 0; k < toAdd; k++) {
            let li = document.createElement("li");
            notesElement.appendChild(li);
            noteBullets.push(li);
        }
    }

    showSolution = false;
    generateScore();
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
    if (Object.keys(keyToNote).includes(e.target.value)) {
        lowestNote = e.target.value;
        localStorage.setItem("lowest-note", lowestNote);
    } else {
        e.target.value = lowestNote;
    }
});

highestNoteInput.addEventListener("change", function (e) {
    if (Object.keys(keyToNote).includes(e.target.value)) {
        highestNote = e.target.value;
        localStorage.setItem("highest-note", highestNote);
    } else {
        e.target.value = highestNote;
    }
});

transposeInput.addEventListener("change", function (e) {
    if (Object.keys(keyToNote).includes(e.target.value)) {
        transposeInstrument = e.target.value;
        localStorage.setItem("transpose", transposeInstrument);
    } else {
        e.target.value = transposeInstrument;
    }
});

solutionButton.addEventListener("click", function (e) {
    showSolution = !showSolution;

    if (!showFirstNote && showSolution)
        transcriptElement.classList.remove("hidden");
    else if (!showFirstNote && !showSolution)
        transcriptElement.classList.add("hidden");

    if (generatedScore.length) {
        drawScore(generatedScore);
    }
});

nextMusicButton.addEventListener("click", async function (e) {
    showSolution = false;
    solutionButton.classList.add('loading')
    await generateScore();
});

replayMusicButton.addEventListener("click", async function (e) {
    if (!playing) {
        await playExcerpt()
        solutionButton.classList.remove('loading')
    }
});

function resetNoteBullets() {
    if (noteBullets) {
        noteBullets.forEach(function (bullet) {
            bullet.classList.remove("active");
        })
    }
}

function sample(list) {
    return list[Math.floor(Math.random() * list.length)];
}

function transpose(notes) {
    const concertPitch = keyToNote['C4'];
    const transposePitch = keyToNote[transposeInstrument];
    const difference = concertPitch - transposePitch;
    return notes.map(function (note) {
        return noteToKey[keyToNote[note] + difference];
    })
}

function generateScore() {
    midiLoaded = false;
    replayMusicButton.classList.add('loading')
    let validTune = false;
    while (!validTune) {
        const tune = sample(scores).notes;
        const musicStart = Math.floor(Math.random() * (tune.length - numberNotes));
        console.log(tune);

        generatedScore = tune.slice(musicStart, musicStart + numberNotes);
        console.log(generatedScore);
        generatedScore = generatedScore.map(function (n) {
            return noteToKey[n];
        });
        console.log(generatedScore);

        validTune = true;
        const transposedTune = transpose(generatedScore);
        for (let k = 0; k < generatedScore.length; k++) {
            if (keyToNote[transposedTune[k]] < keyToNote[lowestNote]
                || keyToNote[transposedTune[k]] > keyToNote[highestNote]) {
                validTune = false;
            }
        }
    }

    if (showFirstNote) {
        drawScore(generatedScore);
    }

    midiLoaded = true;
    replayMusicButton.classList.remove('loading')
}


function addNoteElements() {
    /**
     * Add the bullets to keep track of which note is played
     */
    // Remove current elements
    while (notesElement.firstChild) notesElement.removeChild(notesElement.firstChild);
    // Add the new ones.
    for (let k = 0; k < numberNotes; k++) {
        let li = document.createElement("li");
        notesElement.appendChild(li);
        noteBullets.push(li);
    }
};

function drawScore(notes) {
    /**
     * Draw the staff
     * @type {string}
     */
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

async function playExcerpt(excerpt) {
    playing = true;
    for (let k = 0; k < generatedScore.length; k++) {
        let note = generatedScore[k]
        noteBullets[k].classList.add('active');
        synth.triggerAttackRelease(note, 0.5)
        await sleep(1000);
        noteBullets[k].classList.remove('active');
    }
    playing = false;
}


// window.onload = function () {
//     MIDI.loadPlugin({
//         soundfontUrl: "./soundfont/",
//         instrument: "acoustic_grand_piano", // or the instrument code 1 (aka the default)
//         onprogress: function (state, progress) {
//             console.log(state, progress);
//         },
//         onsuccess: async function () {
//             console.log("success")
//
//             player = MIDI.Player;
//
//             player.addListener(counterListener);
//             nextMusicButton.classList.remove('loading')
//
//             addNoteElements();
//
//             await loadMIDIFile()
//
//             nextMusicButton.addEventListener("click", async function (e) {
//                 showSolution = false;
//                 solutionButton.classList.add('loading')
//                 await loadMIDIFile()
//             });
//
//             replayMusicButton.addEventListener("click", async function (e) {
//                 if (!playing) {
//                     await playExcerpt()
//                     solutionButton.classList.remove('loading')
//                 }
//             });
//         }
//     });
// }
//
//
