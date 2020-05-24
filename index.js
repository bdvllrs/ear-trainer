const localStorage = window.localStorage;
window.AudioContext = window.AudioContext || window.webkitAudioContext;
const audioContext = new AudioContext();
const MAX_SIZE = Math.max(4, Math.floor(audioContext.sampleRate / 5000));
let mediaStreamSource;
let analyser;
let showSolution = false;
let numberNotes;
let playing = false;
let played = false;
let recordAfterPlaying = false;
let isRecording = false;
let showFirstNote;
let highestNote;
let lowestNote;
let transposeInstrument;
let noteBullets = [];
let scores;
let recordedNotes = [];
let lastRecordedNote;
let correctRecordedNotes = 0;
const {keyToNote, noteToKey} = makeKeyToNote();
let synth;
let generatedScore = [];
let generatedScoreTransposed = [];
let midiLoaded = false;
let nextButton,
    playButton,
    answerButton,
    recordButton,
    notesElement,
    transcriptElement,
    showFirstNoteInput,
    numberNoteInput,
    lowestNoteInput,
    highestNoteInput,
    transposeInput;

window.onload = function () {
    // DOM elements
    nextButton = document.getElementById('next');
    playButton = document.getElementById('play');
    answerButton = document.getElementById("answer");
    recordButton = document.getElementById("record");
    notesElement = document.getElementById("notes");
    transcriptElement = document.getElementById("transcript");
    showFirstNoteInput = document.getElementById("show-first-notes");
    numberNoteInput = document.getElementById("number-notes");
    lowestNoteInput = document.getElementById("lowest-note");
    highestNoteInput = document.getElementById("highest-note");
    transposeInput = document.getElementById("transpose");

    showFirstNote = showFirstNoteInput.checked;
    numberNotes = parseInt(numberNoteInput.value);
    highestNote = highestNoteInput.value;
    lowestNote = lowestNoteInput.value;
    transposeInstrument = transposeInput.value;


    synth = new Tone.Sampler(Soundfont, function () {
        // Get the scores
        fetch("scores.json")
            .then(async function (resp) {
                scores = await resp.json();

                nextButton.classList.remove('loading')
                addNoteElements();
                generateScore();
            })
            .catch(function (err) {
                console.log(err);
            });
    }).toMaster();


    if (showFirstNote) {
        transcriptElement.classList.remove("hidden");
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

    recordButton.addEventListener("click", function (e) {
        if (played) {
            toggleLiveInput();
        }
    });

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
            generatedScoreTransposed = transpose(generatedScore);
        } else {
            e.target.value = transposeInstrument;
        }
    });

    answerButton.addEventListener("click", clickAnwserButtonCallback);

    nextButton.addEventListener("click", async function (e) {
        showSolution = false;
        answerButton.classList.add('loading')
        resetDrawValidRecordedNotes();
        await generateScore();
        await playExcerpt();
        answerButton.classList.remove('loading')
    });

    playButton.addEventListener("click", async function (e) {
        if (!playing) {
            answerButton.classList.add('loading')
            await playExcerpt();
            answerButton.classList.remove('loading')
        }
    });

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

function clickAnwserButtonCallback() {
    if (played && !playing) {
        showSolution = !showSolution;
        if (showSolution) {
            answerButton.classList.add('active')
        } else {
            answerButton.classList.remove('active')
        }

        if (!showFirstNote && showSolution)
            transcriptElement.classList.remove("hidden");
        else if (!showFirstNote && !showSolution)
            transcriptElement.classList.add("hidden");

        if (generatedScore.length) {
            drawScore(generatedScore);
        }
    }
}

function generateScore() {
    midiLoaded = false;
    recordButton.classList.remove('active')
    playButton.classList.add('loading')
    recordButton.classList.add('loading')
    let validTune = false;
    while (!validTune) {
        const tune = sample(scores).notes;
        const musicStart = Math.floor(Math.random() * (tune.length - numberNotes));

        generatedScore = tune.slice(musicStart, musicStart + numberNotes);
        generatedScore = generatedScore.map(function (n) {
            return noteToKey[n];
        });

        validTune = true;
        const transposedTune = transpose(generatedScore);
        for (let k = 0; k < generatedScore.length; k++) {
            if (keyToNote[transposedTune[k]] < keyToNote[lowestNote]
                || keyToNote[transposedTune[k]] > keyToNote[highestNote]) {
                validTune = false;
            }
        }
    }
    generatedScoreTransposed = transpose(generatedScore);

    if (showFirstNote) {
        drawScore(generatedScore);
    }

    midiLoaded = true;
    played = false;
    playButton.classList.remove('loading')
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
}


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
        const width = Math.min(960, window.innerWidth - 40);
        renderer.resize(width, 200);
        // And get a drawing context:
        let context = renderer.getContext();

        // Create a stave at position 10, 40 of width 400 on the canvas.
        let stave = new VF.Stave(0, 0, width);


        if (!showSolution) {
            notes = notes.slice(0, 1);
        }

        notes = transpose(notes);

        let staveElement = [];
        let firstClef;
        let lastClef;

        notes.forEach(function (note) {
            let clef = "treble";
            if (keyToNote[note] <= keyToNote['C3']) {
                clef = "bass";
            }
            if (!firstClef) {
                firstClef = clef;
                lastClef = clef;
            }
            if (clef !== lastClef) {
                staveElement.push(new VF.ClefNote(clef));
            }
            const n = note.slice(0, -1) + "/" + note.slice(-1);
            let staveNote = new VF.StaveNote({clef: clef, keys: [n], duration: "q"})
            if (note.slice(1, 2) === "#") {
                staveNote = staveNote.addAccidental(0, new VF.Accidental("#"));
            } else if (note.slice(1, 2) === "b") {
                staveNote = staveNote.addAccidental(0, new VF.Accidental("b"));
            }
            staveElement.push(staveNote);
            lastClef = clef;
        });
        if (!firstClef) {
            firstClef = "treble";
        }

        // Add a clef
        stave.addClef(firstClef);

        // Connect it to the rendering context and draw!
        stave.setContext(context).draw();

        // Create a voice in 4/4 and add the notes from above
        let voice = new VF.Voice({num_beats: notes.length, beat_value: 4});
        voice.addTickables(staveElement);

        // Format and justify the notes to 400 pixels.
        let formatter = new VF.Formatter().joinVoices([voice]).format([voice], width);

        // Render voice
        voice.draw(context, stave);
    }
}

async function playExcerpt() {
    playing = true;
    playButton.classList.add('loading')
    for (let k = 0; k < generatedScore.length; k++) {
        let note = generatedScore[k]
        noteBullets[k].classList.add('active');
        synth.triggerAttackRelease(note, 0.5)
        await sleep(1000);
        noteBullets[k].classList.remove('active');
    }
    playing = false;
    played = true;
    playButton.classList.remove('loading')
    recordButton.classList.remove('loading')
    if (recordAfterPlaying) {
        console.log("record...")
        recordButton.classList.add('active')
        isRecording = true;
        updatePitch();
    }
}


function getUserMedia(constraints, callback) {
    try {
        navigator.getUserMedia =
            navigator.getUserMedia ||
            navigator.webkitGetUserMedia ||
            navigator.mozGetUserMedia
        navigator.getUserMedia(constraints, callback, function (e) {
            console.log(e);
        });
    } catch (e) {
        console.log('getUserMedia threw exception :' + e);
    }
}

function gotStream(stream) {
    recordAfterPlaying = true;
    recordButton.classList.add("active");
    // Create an AudioNode from the stream.
    mediaStreamSource = audioContext.createMediaStreamSource(stream);

    // Connect it to the destination.
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 2048;
    mediaStreamSource.connect(analyser);

    isRecording = true;
    updatePitch();
}


function toggleLiveInput() {
    getUserMedia(
        {
            "audio": {
                "mandatory": {
                    "googEchoCancellation": "false",
                    "googAutoGainControl": "false",
                    "googNoiseSuppression": "false",
                    "googHighpassFilter": "false"
                },
                "optional": []
            },
        }, gotStream);
}

let buflen = 1024;
let buf = new Float32Array(buflen);


function noteFromPitch(frequency) {
    let noteNum = 12 * (Math.log(frequency / 440) / Math.log(2));
    return Math.round(noteNum) + 69;
}

function frequencyFromNoteNumber(note) {
    return 440 * Math.pow(2, (note - 69) / 12);
}

let MIN_SAMPLES = 0;  // will be initialized when AudioContext is created.
let GOOD_ENOUGH_CORRELATION = 0.9; // this is the "bar" for how close a correlation needs to be
let rafID = null;

function autoCorrelate(buf, sampleRate) {
    let SIZE = buf.length;
    let MAX_SAMPLES = Math.floor(SIZE / 2);
    let best_offset = -1;
    let best_correlation = 0;
    let rms = 0;
    let foundGoodCorrelation = false;
    let correlations = new Array(MAX_SAMPLES);

    for (let i = 0; i < SIZE; i++) {
        let val = buf[i];
        rms += val * val;
    }
    rms = Math.sqrt(rms / SIZE);
    if (rms < 0.01) // not enough signal
        return -1;

    let lastCorrelation = 1;
    for (let offset = MIN_SAMPLES; offset < MAX_SAMPLES; offset++) {
        let correlation = 0;

        for (let i = 0; i < MAX_SAMPLES; i++) {
            correlation += Math.abs((buf[i]) - (buf[i + offset]));
        }
        correlation = 1 - (correlation / MAX_SAMPLES);
        correlations[offset] = correlation; // store it, for the tweaking we need to do below.
        if ((correlation > GOOD_ENOUGH_CORRELATION) && (correlation > lastCorrelation)) {
            foundGoodCorrelation = true;
            if (correlation > best_correlation) {
                best_correlation = correlation;
                best_offset = offset;
            }
        } else if (foundGoodCorrelation) {
            // short-circuit - we found a good correlation, then a bad one, so we'd just be seeing copies from here.
            // Now we need to tweak the offset - by interpolating between the values to the left and right of the
            // best offset, and shifting it a bit.  This is complex, and HACKY in this code (happy to take PRs!) -
            // we need to do a curve fit on correlations[] around best_offset in order to better determine precise
            // (anti-aliased) offset.

            // we know best_offset >=1,
            // since foundGoodCorrelation cannot go to true until the second pass (offset=1), and
            // we can't drop into this clause until the following pass (else if).
            let shift = (correlations[best_offset + 1] - correlations[best_offset - 1]) / correlations[best_offset];
            return sampleRate / (best_offset + (8 * shift));
        }
        lastCorrelation = correlation;
    }
    if (best_correlation > 0.01) {
        // console.log("f = " + sampleRate/best_offset + "Hz (rms: " + rms + " confidence: " + best_correlation + ")")
        return sampleRate / best_offset;
    }
    return -1;
}

function validateRecording(noteSequence) {
    // return Math.min(noteSequence.length, generatedScore.length);
    const lastItem = noteSequence.length - 1;
    if (noteSequence[lastItem] === generatedScoreTransposed[lastItem]) {
        return lastItem + 1;
    }
    return -(lastItem + 1);
    // let lastSequenceItem = -1;
    // let isValid = 0;  // -(index of incorrect note +1) if not valid, otherwise number of correct notes.
    // // For each note in the original sequence, we will
    // // check that the note appears in the generated sequence
    // transposedScore.forEach(function (note) {
    //     if (isValid >= 0) {
    //         for (let k = lastSequenceItem + 1; k < noteSequence.length; k++) {
    //             // If first loop iteration and note is incorrect, the sequence is wrong.
    //             if (k === lastSequenceItem + 1 && noteSequence[k] !== note) {
    //                 isValid = -isValid - 1
    //                 break;
    //             }
    //             // If note changes, we go to the next note in the score
    //             if (noteSequence[k] !== note) {
    //                 lastSequenceItem = k;
    //                 break;
    //             }
    //             // We have a correct note, increase the number of valid note
    //             if (k === lastSequenceItem + 1) {
    //                 isValid++;
    //             }
    //         }
    //     }
    // });
    // return isValid;
}

function resetDrawValidRecordedNotes() {
    noteBullets.forEach(function(bullet) {
        bullet.classList.remove("valid");
        bullet.classList.remove("wrong");
    });
}

function drawValidRecordedNotes() {
    if (correctRecordedNotes >= 1) {
        noteBullets[correctRecordedNotes - 1].classList.add("valid");
    }
    else if (correctRecordedNotes < 0) {
        noteBullets[-correctRecordedNotes - 1].classList.add("wrong");
    }
}

function updatePitch(time) {
    analyser.getFloatTimeDomainData(buf);
    let ac = autoCorrelate(buf, audioContext.sampleRate);

    let noteString;
    if (ac !== -1) {
        if (!recordedNotes.length) {
            resetDrawValidRecordedNotes();
        }

        let note = noteFromPitch(ac);
        noteString = noteToKey[note];
        // FIXME: not working if notes are slurred.
        if (noteString && !lastRecordedNote) {
            recordedNotes.push(noteString);
        }

        correctRecordedNotes = validateRecording(recordedNotes);
        console.log(recordedNotes);
        console.log(correctRecordedNotes);
        drawValidRecordedNotes();
        // Replayed the score correctly
        if (correctRecordedNotes === generatedScore.length) {
            if (!showSolution) {
                clickAnwserButtonCallback();
            }
            recordedNotes = [];
            correctRecordedNotes = 0;
            isRecording = false;
            recordButton.classList.remove("active");
        }
        if (correctRecordedNotes < 0) {
            recordedNotes = [];
            correctRecordedNotes = 0;
        }
    }
    lastRecordedNote = noteString;

    if (!isRecording || playing) {
        if (!window.cancelAnimationFrame)
            window.cancelAnimationFrame = window.webkitCancelAnimationFrame;
        window.cancelAnimationFrame(rafID);
    } else {
        if (!window.requestAnimationFrame)
            window.requestAnimationFrame = window.webkitRequestAnimationFrame;
        rafID = window.requestAnimationFrame(updatePitch);
    }
}
