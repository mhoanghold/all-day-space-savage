function Invader() {
    this.$ammo_container = this.findByClassName('js-ammo-container');
    this.$ship_container = this.findByClassName('js-ship-container');
    this.$enemy_container = this.findByClassName('js-enemy-container');
    this.$stats_container = this.findByClassName('js-stats-container');
}

Invader.prototype = {
    columns: 30,
    rows: 20,
    score: 0,
    kills: 0,
    points_per_hit: 20,
    lives: 3,
    ship_max_lives: 3,
    ship_width: 7,
    ship_height: 4,
    ship_life: 16,
    ship_max_life: 16,
    ship_x: 0,
    enemy_width: 7,
    enemy_height: 4,
    enemy_life: 16,
    enemy_max_life: 16,
    enemy_direction: 1,
    enemy_x: 0,
    off: 'O',
    on: 'X',
    between: '_',
    ship_ammo: 'V',
    enemy_ammo: 'V',
    go_right: 68,
    go_left: 65,
    fire_ammo: 32,
    ammo_coordinates: {},
    ammo_interval_time: 100,
    enemy_fire_interval_time: 1500,
    audio_buffers: {},
    sounds: {
        0: 'https://s3.amazonaws.com/all-day/INVADER-LV1.mp3',
        1: 'https://s3.amazonaws.com/all-day/INVADER-LV2.mp3',
        2: 'https://s3.amazonaws.com/all-day/INVADER-LV3.mp3',
        3: 'https://s3.amazonaws.com/all-day/INVADER-LV4.mp3'
    },
    current_sound: null,
    sound_interval: 7680,
    original_sound_interval: 7680,
    next_sound: 0,
    sound_interval_object: null,
    player_death: 'https://s3.amazonaws.com/all-day/playerdeath.wav',
    player_hit: 'https://s3.amazonaws.com/all-day/playerhit.wav',
    player_fire: 'https://s3.amazonaws.com/all-day/shot.wav',
    enemy_hit: 'https://s3.amazonaws.com/all-day/enemyhit.wav',
    enemy_fire: 'https://s3.amazonaws.com/all-day/enemyshot.wav',
    enemy_death: 'https://s3.amazonaws.com/all-day/enemydeath.wav',
    game_sounds: {},
    game_sound_counts: {},
    game_audio_context: null,

    init: function () {
        this.buildAmmoGrid();
        this.buildShip();
        this.buildEnemy();
        this.initEnemyAI();
        this.bindControls();
        this.updateAmmoGrid();
        this.audio_context = this.initAudioContext();
        this.game_audio_context = this.initAudioContext();
        this.loadSongs();
        this.loadPlaySound(0);
        this.observeSound();
    },

    initAudioContext: function () {
        if (typeof AudioContext !== "undefined") {
            var audio_context = new AudioContext();
        } else if (typeof webkitAudioContext !== "undefined") {
            var audio_context = new webkitAudioContext();
        } else {
            throw new Error('AudioContext not supported. :(');
        }

        return audio_context;
    },

    loadGameSound: function (name) {
        var request, self = this;
        request = new XMLHttpRequest();
        request.open("GET", this[name], true);
        request.responseType = "arraybuffer";

        request.onload = function () {
            self.game_sounds[name] = request.response;
            self.game_sound_counts[name] = 0;
            self.audio_context.decodeAudioData(self.game_sounds[name], function (buffer) {
                var sound = self.createAudioContext(buffer, true);
                sound.sound_source.start();
            });
        };

        request.send();
    },

    playGameSound: function (name) {
        var self = this;

        if (!this.game_sounds[name]) {
            this.loadGameSound(name);
        } else {
            this.audio_context.decodeAudioData(this.game_sounds[name], function (buffer) {
                var sound = self.createAudioContext(buffer, true);
                sound.sound_source.start();
            });
        }

    },

    observeSound: function () {
        var self = this;
        this.sound_interval_object = setInterval(function () {
            console.log(self.audio_buffers)
            if (self.change_sound) {
                self.loadPlaySound(self.next_sound);
                self.change_sound = false;
            }
        }, this.sound_interval);
    },

    createAudioContext: function (buffer, game_sound) {
        var audio_context = game_sound ? this.game_audio_context : this.audio_context;
        var sound_source = audio_context.createBufferSource();
        sound_source.buffer = buffer;
        if (!game_sound) {
            sound_source.loop = true;
            sound_source.connect(audio_context.destination);
        } else {
            var gain_node = audio_context.createGain();
            gain_node.gain.value = 0.15;
            sound_source.connect(gain_node);
            gain_node.connect(audio_context.destination);
        }

        return {
            sound_source: sound_source,
            audio_context: audio_context
        }
    },


    loadSongs: function () {
        for (var name in this.sounds) {
            this.loadSound(name, false);
        }
    },

    playSound: function (name) {
        if (this.current_sound) {
            this.current_sound.sound_source.stop();
        }
        this.audio_buffers[name].sound_source.start(0);
        this.current_sound = this.audio_buffers[name];
    },

    loadSound: function(name, play) {
        var self = this,
            request = new XMLHttpRequest();
        request.open("GET", this.sounds[name], true);
        request.responseType = "arraybuffer";

        request.onload = function () {
            self.audio_context.decodeAudioData(request.response, function (buffer) {
                self.audio_buffers[name] = self.createAudioContext(buffer, false);
                if (play) {
                    if (self.current_sound) {
                        self.current_sound.sound_source.stop();
                    }
                    self.playSound(name);
                }
            });
        };

        request.send();
    },

    loadPlaySound: function (name) {
        if (this.audio_buffers[name]) {
            this.playSound(name);
        } else {
            this.loadSound(name, true);
        }
    },

    initEnemyAI: function () {
        var self = this;
        setInterval(function () {
            self.fireEnemyAmmo(false);
        }, this.enemy_fire_interval_time);
    },

    updateAmmoGrid: function () {
        var self = this;
        setInterval(function () {
            self.moveEnemy();
            self.buildEnemy();
            self.updateAmmoCoordinates();
            self.buildAmmoGrid();
            self.buildShip();
            self.updateStats();
        }, this.ammo_interval_time);
    },

    moveEnemy: function () {
        if (this.enemy_direction > 0) {
            this.enemy_x += Math.floor(Math.random() * 6) + 1;
        } else {
            this.enemy_x -= Math.floor(Math.random() * 6) + 1;
        }

        if (this.enemy_x > this.columns - this.ship_width + 1) {
            this.enemy_x = this.columns - this.ship_width + 1;
            this.enemy_direction = -1;
        }

        if (this.enemy_x < 0) {
            this.enemy_x = 0;
            this.enemy_direction = 1;
        }
    },

    updateAmmoCoordinates: function () {
        var coords, valid, friendly, coordinates = {};
        for (var prop in this.ammo_coordinates) {
            coords = this.coords(prop);
            friendly = this.ammo_coordinates[prop].friendly;

            valid = true;
            if (friendly) {
                coords.y -= 1;
                if (coords.y < 0) {
                    valid = false;
                    if (this.hasHitEnemy(coords.x)) {
                        this.enemy_life -= 1;
                        this.score += this.points_per_hit;
                        this.playGameSound('enemy_hit');
                        this.updateStats();
                    }
                }
            } else {
                coords.y += 1;
                if (coords.y > this.rows) {
                    valid = false;
                    if (this.hasHitFriendly(coords.x)) {
                        this.playGameSound('player_hit');
                        this.ship_life -= 1;
                        if (this.ship_life == 0) {
                            this.ship_life = this.ship_max_life;
                            this.lives -= 1;
                            if (this.lives <= 0) {
                                this.playGameSound('player_death');
                                this.restartGame();
                            }
                        }
                    }
                }

            }

            if (valid) {
                coordinates[this.xy(coords.x, coords.y)] = {
                    friendly: friendly
                }
            }
        }

        this.ammo_coordinates = coordinates;
    },

    updateStats: function () {
        var stats = ['score', 'lives', 'kills'], stats_n = 0, item_index = 0, item = stats[item_index], text, $item;

        this.$stats_container.innerHTML = '';
        for (var n = 0; n <= this.columns; n++) {
            $item = this.createElement('div', 'item');
            if (item != undefined && stats_n >= item.length) {
                var $colon = this.createElement('div', 'item stats', ':');
                var $value = this.createElement('div', 'item stats', this[item]);
                var $spacing1 = this.createElement('div', 'item', '&nbsp;');
                var $spacing2 = this.createElement('div', 'item', '&nbsp;');
                var $spacing3 = this.createElement('div', 'item', '&nbsp;');
                var $spacing4 = this.createElement('div', 'item', '&nbsp;');
                this.$stats_container.appendChild($colon);
                this.$stats_container.appendChild($value);
                this.$stats_container.appendChild($spacing1);
                this.$stats_container.appendChild($spacing2);
                this.$stats_container.appendChild($spacing3);
                this.$stats_container.appendChild($spacing4);
                stats_n = 0;
                item_index += 1;
                item = stats[item_index];
            }
            if (item != undefined) {
                text = item[stats_n];
            } else {
                text = ' '
            }
            $item.innerText = text;
            $item.className += ' stats';
            stats_n += 1;
            this.$stats_container.appendChild($item);
        }
    },

    restartGame: function () {
        this.ship_x = 0;
        this.ship_life = this.ship_max_life;
        this.lives = this.ship_max_lives;
        this.enemy_life = this.enemy_max_life;
        this.enemy_x = 0;
        this.kills = 0;
        this.score = 0;
    },

    hasHitEnemy: function (x) {
        return (x >= this.enemy_x && x <= this.enemy_x + this.enemy_width - 1)
    },

    hasHitFriendly: function (x) {
        return (x >= this.ship_x && x <= this.ship_x + this.ship_width - 1)
    },

    bindControls: function () {
        var self = this, keys_pressed = {};
        keys_pressed[this.go_left] = false;
        keys_pressed[this.go_right] = false;
        keys_pressed[this.fire_ammo] = false;

        document.onkeydown = function (e) {
            if (e.keyCode in keys_pressed) {
                keys_pressed[e.keyCode] = true;
                if (keys_pressed[self.go_left] && keys_pressed[self.fire_ammo]) {
                    self.commandAtKey(self.go_left);
                    self.commandAtKey(self.fire_ammo);
                } else if (keys_pressed[self.go_right] && keys_pressed[self.fire_ammo]) {
                    self.commandAtKey(self.go_right);
                    self.commandAtKey(self.fire_ammo);
                } else if (!keys_pressed[self.fire_ammo]) {
                    if (keys_pressed[self.go_right]) {
                        self.commandAtKey(self.go_right);
                    }
                    if (keys_pressed[self.go_left]) {
                        self.commandAtKey(self.go_left);
                    }
                } else if (keys_pressed[self.fire_ammo]) {
                    self.commandAtKey(self.fire_ammo);
                }
            }

            self.buildShip();
        };

        document.onkeyup = function (e) {
            if (e.keyCode in keys_pressed) {
                keys_pressed[e.keyCode] = false;
            }
        };
    },

    commandAtKey: function (keyCode) {
        if (keyCode == this.go_left) {
            this.ship_x -= 1;
            this.ship_x = Math.max(this.ship_x, 0);
        }
        if (keyCode == this.go_right) {
            this.ship_x += 1;
            this.ship_x = Math.min(this.ship_x, this.columns - this.ship_width + 1);
        }
        if (keyCode == this.fire_ammo) {
            this.fireAmmo();
        }
    },

    buildAmmoGrid: function () {
        var i, n, text, $row, $item, ammo, friendly, class_name;
        this.$ammo_container.innerHTML = '';

        for (i = 0; i <= (this.rows); i++) {
            $row = this.createElement('div', 'row ammo-grid clearfix');
            for (n = 0; n <= this.columns; n++) {
                ammo = this.ammo_coordinates[this.xy(n, i)];
                friendly = ammo != null && ammo.friendly == true
                text = ammo == null ? this.off : (friendly ? this.ship_ammo : this.enemy_ammo);
                class_name = ammo == null ? 'item' : (friendly ? 'item ammo friendly' : 'item ammo enemy');
                $item = this.createElement('div', class_name, text);
                $row.appendChild($item);
            }
            this.$ammo_container.appendChild($row);
        }
    },

    buildShip: function () {
        var ship = this.shipAtX(), x, y, $row;
        this.$ship_container.innerHTML = '';

        for (y = 0; y < ship.length; y++) {
            $row = this.createElement('div', 'row ship-row clearfix');
            for (x = 0; x < ship[0].length; x++) {
                $item = this.createElement('div', 'item', ship[y][x]);
                if (ship[y][x] == this.on || ship[y][x] == this.between) {
                    $item.className += ' ship';
                }

                $row.appendChild($item);
            }
            this.$ship_container.appendChild($row);
        }
    },

    shipAtX: function () {
        var row, text, ship_pieces = 1, ship_array = [], i, n, ship_thickness = 0, first_x = Math.floor(this.ship_width / 2) + this.ship_x;
        for (i = 0; i < this.ship_height; i++) {
            row = []
            for (n = 0; n <= this.columns; n++) {
                if (n >= first_x && n <= first_x + ship_thickness) {
                    text = ship_pieces > this.ship_life ? this.between : this.on;
                    row.push(text);
                    ship_pieces += 1;
                } else {
                    row.push(this.off);
                }
            }
            ship_array.push(row);
            ship_thickness += 2;
            first_x -= 1;
        }
        return ship_array;
    },

    fireAmmo: function () {
        var ammo_x = Math.floor(this.ship_width / 2) + this.ship_x,
            ammo_y = this.rows + 1;
        this.ammo_coordinates[this.xy(ammo_x, ammo_y)] = {
            friendly: true
        };
        this.playGameSound('player_fire');
    },

    buildEnemy: function () {
        var enemy = this.enemyAtX(), x, y, $row, $item;
        this.$enemy_container.innerHTML = '';

        for (y = 0; y < enemy.length; y++) {
            $row = this.createElement('div', 'row enemy-row clearfix');
            for (x = 0; x < enemy[0].length; x++) {
                $item = this.createElement('div', 'item', enemy[y][x]);
                if (enemy[y][x] == this.on || enemy[y][x] == this.between) {
                    $item.className += ' enemy';
                }

                $row.appendChild($item);
            }
            this.$enemy_container.appendChild($row);
        }
    },

    enemyAtX: function () {
        var row, text, enemy_pieces = 1, enemy_array = [], i, n, enemy_thickness = this.enemy_width, first_x = 0 + this.enemy_x;

        for (i = 0; i < this.enemy_height; i++) {
            row = [];
            for (n = 0; n < this.columns + 1; n++) {
                if (n >= first_x && n <= first_x + enemy_thickness - 1) {
                    text = enemy_pieces > this.enemy_life ? this.between : this.on;
                    row.push(text);
                    enemy_pieces += 1;
                    if (this.enemy_life <= 0) {
                        this.restartEnemy();
                    }
                } else {
                    row.push(this.off);
                }
            }
            enemy_array.push(row);
            enemy_thickness -= 2;
            first_x += 1;
        }
        return enemy_array;
    },

    fireEnemyAmmo: function () {
        var ammo_x = this.enemy_x + Math.floor(this.enemy_width / 2),
            ammo_y = -1;
        this.ammo_coordinates[this.xy(ammo_x, ammo_y)] = {
            friendly: false
        };
        this.playGameSound('enemy_fire');
    },

    restartEnemy: function () {
        this.playGameSound('enemy_death');
        this.enemy_life = this.enemy_max_life;
        this.kills += 1;
        if (this.kills == 2) {
            this.changeObserveInterval();
        }
        if (this.kills <= this.size(this.sounds) - 1) {
            this.change_sound = true;
            this.next_sound = Math.min(this.kills, this.size(this.sounds) - 1);
        } else if (this.kills == this.size(this.sounds) || (this.kills > this.size(this.sounds))) {
            this.next_sound = this.next_sound == this.size(this.sounds) - 1 ? this.size(this.sounds) - 2 : this.size(this.sounds) - 1;
            this.change_sound = true;
        }
        console.log(491, this.next_sound, this.sound_interval);
    },

    changeObserveInterval: function () {
        clearInterval(this.sound_interval_object);
        this.sound_interval *= 2;
        this.observeSound();
    },

    coords: function (coords) {
        var parts = coords.split(',');

        return {
            x: parseInt(parts[0], 10),
            y: parseInt(parts[1], 10)
        }
    },

    xy: function (x, y) {
        return [x, y].join(',')
    },

    size: function (obj) {
        var size = 0, key;
        for (key in obj) {
            if (obj.hasOwnProperty(key)) size++;
        }
        return size;
    },

    findByClassName: function (className) {
        return document.getElementsByClassName(className)[0]
    },

    createElement: function (tag, className, innerHTML) {
        tag = document.createElement(tag);
        tag.className = className;
        if (innerHTML != null) {
            tag.innerHTML = innerHTML;
        }
        return tag;
    }
};