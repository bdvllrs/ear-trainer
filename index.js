const localStorage = window.localStorage;
window.AudioContext = window.AudioContext || window.webkitAudioContext;
const audioContext = new AudioContext();
const VF = Vex.Flow;
let pitchAnalyzer;
let mediaStreamSource;
let mediaStream;
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
let lastRecordedNote;
let itemLastCorrectRecordedNote = -1;
let playBackSpeed = 500;
const {keyToNote, noteToKey} = makeKeyToNote();
let synth;
let generatedScore = [];
let generatedScoreTransposed = [];
let midiLoaded = false;
let nextButton,
    playButton,
    answerButton,
    recordButton,
    stopRecordButton,
    notesElement,
    transcriptElement,
    pitchPlayingElement,
    noteButtonsElement,
    intervalButtonsElement,
    showFirstNoteInput,
    randomScoreInput,
    numberNoteInput,
    lowestNoteInput,
    highestNoteInput,
    transposeInput,
    useRandomScores,
    playBackSpeedRange,
    selectedNotes,
    selectedIntervals,
    intervalsToSemiTones;

window.onload = function () {
    // DOM elements
    nextButton = document.getElementById('next');
    playButton = document.getElementById('play');
    answerButton = document.getElementById("answer");
    recordButton = document.getElementById("record");
    stopRecordButton = document.getElementById("stop-record");
    notesElement = document.getElementById("notes");
    transcriptElement = document.getElementById("transcript");
    pitchPlayingElement = document.getElementById("pitch-playing")
    showFirstNoteInput = document.getElementById("show-first-notes");
    randomScoreInput = document.getElementById("random-score");
    numberNoteInput = document.getElementById("number-notes");
    lowestNoteInput = document.getElementById("lowest-note");
    highestNoteInput = document.getElementById("highest-note");
    transposeInput = document.getElementById("transpose");
    playBackSpeedRange = document.getElementById("play-back-speed");
    noteButtonsElement = document.getElementById("note-buttons");
    intervalButtonsElement = document.getElementById("interval-buttons");

    showFirstNote = showFirstNoteInput.checked;
    useRandomScores = randomScoreInput.checked;
    numberNotes = parseInt(numberNoteInput.value);
    highestNote = highestNoteInput.value;
    lowestNote = lowestNoteInput.value;
    transposeInstrument = transposeInput.value;

    selectedNotes = {"C": true, "Db": false, "D": true, "Eb": false, "E": true, "F": true, "Gb": false, "G": true, "Ab": false, "A": true, "Bb": false, "B": true};
    selectedIntervals = {"m2": true, "M2": true, "m3": false, "M3": false, "P4": true, "d5": false, "P5": true, "m6": false, "M6": false, "m7": false, "M7": false, "P8": true};
    intervalsToSemiTones = {"m2": 1, "M2": 2, "m3": 3, "M3": 4, "P4": 5, "d5": 6, "P5": 7, "m6": 8, "M6": 9, "m7": 10, "M7": 11, "P8": 12};


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

    if (localStorage.getItem("number-notes")) {
        numberNotes = parseInt(localStorage.getItem("number-notes"));
        numberNoteInput.value = numberNotes;
    }

    if (localStorage.getItem("play-back-speed")) {
        playBackSpeed = localStorage.getItem("play-back-speed");
        playBackSpeedRange.value = playBackSpeed;
    }

    if (localStorage.getItem("selected-notes")) {
        selectedNotes = JSON.parse(localStorage.getItem("selected-notes"));
    }

    if (localStorage.getItem("selected-intervals")) {
        selectedIntervals = JSON.parse(localStorage.getItem("selected-intervals"));
    }

    recordButton.addEventListener("click", async function (e) {
        if (played && !isRecording) {
            if (mediaStream) {
                recordButton.classList.add("active");
                stopRecordButton.classList.remove("hidden");
                await audioContext.resume()
                isRecording = true;
                await updatePitch();
            } else toggleLiveInput();
        } else if (isRecording) {
            await audioContext.suspend()
            isRecording = false;
            recordButton.classList.remove("active");
            resetDrawValidRecordedNotes();
            pitchPlayingElement.innerHTML = "";
        }
    });

    stopRecordButton.addEventListener("click", async function (e) {
        if (mediaStream) {
            isRecording = false;
            await stopTracks();
            recordAfterPlaying = false;
            recordButton.classList.remove("active");
            stopRecordButton.classList.add("hidden");
        }
    });

    numberNoteInput.addEventListener("change", async function (e) {
        numberNotes = parseInt(e.target.value);
        localStorage.setItem("number-notes", numberNotes);

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

    randomScoreInput.addEventListener("change", function (e) {
        useRandomScores = e.target.checked;

        showSolution = false;
        generateScore();
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

    answerButton.addEventListener("click", clickAnswerButtonCallback);

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

    playBackSpeedRange.addEventListener("change", function(e) {
        playBackSpeed = e.target.value;
        localStorage.setItem("play-back-speed", playBackSpeed);
    });


    Object.entries(selectedNotes).forEach(([name, selected]) => {
        let button = document.createElement("button");
        button.innerHTML = name;
        if(selected) {
            button.classList.add('active');
        }
        button.classList.add("button");
        button.addEventListener("click", clickNoteButton);
        noteButtonsElement.appendChild(button);
    });

    Object.entries(selectedIntervals).forEach(([name, selected]) => {
        let button = document.createElement("button");
        button.innerHTML = name;
        if(selected) {
            button.classList.add('active');
        }
        button.classList.add("button");
        button.addEventListener("click", clickIntervalButton);
        intervalButtonsElement.appendChild(button);
    });

}

function randomNoteSequence(notes, intervals, numNotes){
    let lastNote = sample(notes);
    let possibleFirstNotes = [];
    for(let k = 0; k <= 7; k++){
        if(keyToNote[lastNote + k.toString()] >= keyToNote[lowestNote] && keyToNote[lastNote + k.toString()] <= keyToNote[highestNote]) {
            possibleFirstNotes.push(lastNote + k.toString())
        }
    }
    lastNote = sample(possibleFirstNotes);
    let noteSequence = [lastNote];

    for(let k = 0; k < numNotes - 1; k++){
        lastNote = sample(possibleNotesFromInterval(lastNote, intervals, notes))
        noteSequence.push(lastNote);
    }
    return noteSequence;
}

function possibleNotesFromInterval(note, intervals, notes){
    let possibleNextNotes = [];
    for(let k = 0; k < intervals.length; k++){
        let pitch = keyToNote[note] + intervalsToSemiTones[intervals[k]];
        if(pitch <= keyToNote[highestNote] && notes.indexOf(noteToKey[pitch].slice(0, -1)) >= 0){
            possibleNextNotes.push(noteToKey[pitch]);
        }
        pitch = keyToNote[note] - intervalsToSemiTones[intervals[k]];
        if(pitch >= keyToNote[lowestNote] && notes.indexOf(noteToKey[pitch].slice(0, -1)) >= 0){
            possibleNextNotes.push(noteToKey[pitch]);
        }
    }
    return possibleNextNotes;
}

function clickNoteButton(e) {
    e.preventDefault();
    const note = e.target.innerHTML;
    if(note in selectedNotes){
        e.target.classList.toggle("active");
        selectedNotes[note] = !selectedNotes[note];
    }
    localStorage.setItem("selected-notes", JSON.stringify(selectedNotes));
}

function clickIntervalButton(e) {
    e.preventDefault();
    const note = e.target.innerHTML;
    if(note in selectedIntervals){
        e.target.classList.toggle("active");
        selectedIntervals[note] = !selectedIntervals[note];
    }
    localStorage.setItem("selected-intervals", JSON.stringify(selectedIntervals));
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
    const alternativePitchNotation = {"Db": "C#", "Eb": "D#", "Gb": "F#", "Ab": "G#", "Bb": "A#"};
    let curNote = 24;
    for (let k = 0; k <= 7; k++) {
        notes.forEach(function (note) {
            const pitch = note + k.toString();
            keyToNote[pitch] = curNote;
            noteToKey[curNote] = pitch;
            if (alternativePitchNotation[note]) {
                keyToNote[alternativePitchNotation[note] + k.toString()] = curNote;
            }
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

function randInt(min, max) {
    return Math.floor(Math.random() * (max - min)) + min
}

function sample(list) {
    return list[randInt(0, list.length)];
}

/**
 * Transpose the notes by shifting up the notes by the amount of shift value
 * @param notes
 * @param shift
 * @returns {*}
 */
function transposeByShift(notes, shift) {
    return notes.map(function (note) {
        return noteToKey[keyToNote[note] + shift];
    });
}

/**
 * Transpose the notes to the transposeInstrument value
 * @param notes
 * @param inverted
 * @returns
 */
function transpose(notes, inverted=false) {
    const concertPitch = keyToNote['C4'];
    const transposePitch = keyToNote[transposeInstrument];
    if(inverted) {
        return transposeByShift(notes, transposePitch - concertPitch);
    }
    return transposeByShift(notes, concertPitch - transposePitch);
}

function clickAnswerButtonCallback() {
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
    if(useRandomScores) {
        generatedScoreTransposed = randomNoteSequence(
            Object.keys(selectedNotes).filter(note => selectedNotes[note]),
            Object.keys(selectedIntervals).filter(interval => selectedIntervals[interval]),
            numberNotes
        )
        generatedScore = transpose(generatedScoreTransposed, true);
    } else {
        let validTune = false;
        const range = keyToNote[highestNote] - keyToNote[lowestNote];
        let minVal, maxVal;
        while (!validTune) {
            const tune = sample(scores).notes;
            const musicStart = Math.floor(Math.random() * (tune.length - numberNotes));

            generatedScore = tune.slice(musicStart, musicStart + numberNotes);
            generatedScore = generatedScore.map(function (n) {
                return noteToKey[n];
            });


            const scoreValues = generatedScore.map(function (note) {
                return keyToNote[note];
            });
            minVal = Math.min.apply(Math, scoreValues);
            maxVal = Math.max.apply(Math, scoreValues);

            // Tune is valid if the difference between highest and lowest is smaller than instrument range.
            if (maxVal - minVal <= range) {
                validTune = true;
            }
        }
        // Then transpose score to have a real random first note.
        // We transpose from the lowest note in the score.
        // Random note can be from lowest instrument note, to highest minus range of the score
        const newLowestNote = randInt(keyToNote[lowestNote], keyToNote[highestNote] - (maxVal - minVal));
        // transpose song for new lowest note
        const shift = newLowestNote - minVal;
        generatedScore = transposeByShift(generatedScore, shift);

        generatedScoreTransposed = transpose(generatedScore);
    }

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
        li.addEventListener("click", async function() {
            if (!playing) {
                await playExcerpt(k);
            }
        });
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
        // Create an SVG renderer and attach it to the DIV element named "boo".
        let renderer = new VF.Renderer(transcriptElement, VF.Renderer.Backends.SVG);
        // Size our SVG:
        const width = Math.min(960, window.innerWidth - 40);
        renderer.resize(width, 300);
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

        let accidentals = {};

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
            const rootNote = note.slice(0, 1);
            let staveNote = new VF.StaveNote({clef: clef, keys: [n], duration: "q"})
            if (note.slice(1, 2) === "#" && accidentals[rootNote] !== "#") {
                accidentals[rootNote] = "#";
                staveNote = staveNote.addAccidental(0, new VF.Accidental("#"));
            } else if (note.slice(1, 2) === "b" && accidentals[rootNote] !== "b") {
                accidentals[rootNote] = "b";
                staveNote = staveNote.addAccidental(0, new VF.Accidental("b"));
            } else if (accidentals[rootNote]) {
                delete accidentals[rootNote];
                staveNote = staveNote.addAccidental(0, new VF.Accidental("n"));
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

        const beams = VF.Beam.generateBeams(staveElement);
        Vex.Flow.Formatter.FormatAndDraw(context, stave, staveElement);
        beams.forEach(function(b) {b.setContext(context).draw()});
    }
}

async function playExcerpt(startNote=0) {
    if (startNote >= generatedScore.length) startNote = 0;
    itemLastCorrectRecordedNote = -1;
    pitchPlayingElement.innerHTML = "";
    resetDrawValidRecordedNotes();
    playing = true;
    recordButton.classList.remove('active')
    recordButton.classList.add('loading')
    playButton.classList.add('loading')
    for (let k = startNote; k < generatedScore.length; k++) {
        let note = generatedScore[k]
        noteBullets[k].classList.add('active');
        synth.triggerAttackRelease(note, 0.8 * playBackSpeed / 1000);
        await sleep(playBackSpeed);
        noteBullets[k].classList.remove('active');
    }
    playing = false;
    played = true;
    playButton.classList.remove('loading')
    recordButton.classList.remove('loading')
    if (recordAfterPlaying) {
        recordButton.classList.add('active')
        await audioContext.resume();
        isRecording = true;
        await updatePitch();
    }
}


function getUserMedia(constraints, callback) {
    try {
        navigator.mediaDevices.getUserMedia(constraints)
            .then(callback)
            .catch(e => console.log(e));
    } catch (e) {
        console.log('getUserMedia threw exception :' + e);
    }
}

async function gotStream(stream) {
    recordAfterPlaying = true;
    recordButton.classList.add("active");
    stopRecordButton.classList.remove("hidden");
    isRecording = true;
    mediaStream = stream;
    // Create an AudioNode from the stream.
    mediaStreamSource = audioContext.createMediaStreamSource(stream);
    // recordingBuffer = audioContext.createBuffer(2, 4096, audioContext.sampleRate);
    // mediaStreamSource.connect(recordingBuffer)

    // Connect it to the destination.
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 4096;
    mediaStreamSource.connect(analyser);
    //
    // pitchAnalyzer = new PitchAnalyzer(audioContext.sampleRate);
    pitchAnalyzer = Pitchfinder.YIN({
        sampleRate: audioContext.sampleRate,
        // threshold: 0.5,
        probabilityThreshold: 0.8
    })

    await updatePitch();
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

let buflen = 4096;
let buf = new Float32Array(buflen);


function noteFromPitch(frequency) {
    let noteNum = 12 * (Math.log(frequency / 440) / Math.log(2));
    return Math.round(noteNum) + 69 + 12;
}

function validateRecording(note) {
    // return Math.min(noteSequence.length, generatedScore.length);
    if (note === generatedScore[itemLastCorrectRecordedNote + 1]) {
        itemLastCorrectRecordedNote++;
        return true;
    }
    return false;
}

function resetDrawValidRecordedNotes() {
    noteBullets.forEach(function (bullet) {
        bullet.classList.remove("valid");
        bullet.classList.remove("wrong");
    });
}

async function stopTracks() {
    pitchPlayingElement.innerHTML = "";
    recordAfterPlaying = true;
    await mediaStream.getTracks().forEach(function (track) {
        track.stop();
    });
    resetDrawValidRecordedNotes();
    mediaStream = null;
}

async function updatePitch(time) {
    analyser.getFloatTimeDomainData(buf);
    const pitch = pitchAnalyzer(buf)

    let noteString;
    if (pitch !== null) {
        let note = noteFromPitch(pitch);
        noteString = noteToKey[note];
        const transposedNoteString = transpose([noteString])[0];
        if (noteString !== lastRecordedNote) {
            if (transposedNoteString) {  // remove undefined notes
                pitchPlayingElement.innerHTML = `<i class="fas fa-music"></i> &nbsp; ${noteString} &nbsp; <i class="fas fa-long-arrow-alt-right"></i> &nbsp; ${transposedNoteString}`;
            }

            if (validateRecording(noteString)) {
                noteBullets[itemLastCorrectRecordedNote].classList.remove("wrong");
                noteBullets[itemLastCorrectRecordedNote].classList.add("valid");
            } else {
                noteBullets[itemLastCorrectRecordedNote + 1].classList.remove("valid");
                noteBullets[itemLastCorrectRecordedNote + 1].classList.add("wrong");
            }
            // Replayed the score correctly
            if (itemLastCorrectRecordedNote === generatedScore.length - 1) {
                pitchPlayingElement.innerHTML = "";
                if (!showSolution) {
                    clickAnswerButtonCallback();
                }
                itemLastCorrectRecordedNote = -1;
                isRecording = false;
                await audioContext.suspend();
                recordButton.classList.remove("active");
            }
        }
    } else {
        pitchPlayingElement.innerHTML = "";
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
