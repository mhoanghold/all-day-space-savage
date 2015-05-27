function Invader() {
    this.$container = this.findByClassName('js-game-container');
    this.$ammo_container = this.findByClassName('js-ammo-container');
    this.$ship_container = this.findByClassName('js-ship-container');
    this.$enemy_container = this.findByClassName('js-enemy-container');
    this.$stats_container = this.findByClassName('js-stats-container');
}

Invader.prototype = {
    $container: null,
    $ammo_container: null,
    $ship_container: null,
    $enemy_container: null,
    $stats_container: null,
    $pyramid_outer: null,
    $enemy_pyramid_outer: null,
    columns: 30,
    rows: 20,
    score: 0,
    kills: 0,
    current_level: 1,
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
    enemy_ammo_coordinates: {},
    ammo_interval_time: 100,
    enemy_fire_interval_time: 1500,
    audio_buffers: {},
    audio_contexts: {},
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
    ammo_id: 0,
    disable_game_board: false,

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
            if (self.change_sound) {
                self.current_level += 1;
                if (self.current_level == 3 && self.$pyramid_outer == null && self.$enemy_pyramid_outer == null) {
                    self.buildFriendlyPyramid();
                    self.buildEnemyPyramid();
                    self.moveEnemyPyramid();
                    self.movePyramid();
                }
                var level_class = self.current_level >= 3 ? 3 : self.current_level;
                self.$container.className = 'js-game-container game-container level-' + level_class;
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
        this.audio_contexts[name] = this.createAudioContext(this.audio_buffers[name], false);
        this.audio_contexts[name].sound_source.start(0);
        this.current_sound = this.audio_contexts[name];
    },

    loadSound: function(name, play) {
        var self = this,
            request = new XMLHttpRequest();
        request.open("GET", this.sounds[name], true);
        request.responseType = "arraybuffer";

        request.onload = function () {
            self.audio_context.decodeAudioData(request.response, function (buffer) {
                self.audio_buffers[name] = buffer;
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
        if (this.disable_game_board) {
            return;
        }
        setInterval(function () {
            self.moveEnemy();
            self.buildEnemy();
            self.updateAmmoCoordinates(true);
            self.updateAmmoCoordinates(false);
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


        var enemy_max = this.columns - this.ship_width;
        if (this.current_level == 2) {
            enemy_max -= 1;
        }

        if (this.enemy_x > enemy_max) {
            this.enemy_x = enemy_max;
            this.enemy_direction = -1;
        }

        if (this.enemy_x < 0) {
            this.enemy_x = 0;
            this.enemy_direction = 1;
        }

        this.moveEnemyPyramid();
    },

    updateAmmoCoordinates: function (friendly) {
        var coords, valid, coordinates = {}, ammo_id, coords_type = friendly ? 'ammo_coordinates' : 'enemy_ammo_coordinates';
        for (var prop in this[coords_type]) {
            coords = this.coords(prop);
            ammo_id = this[coords_type][prop].id;

            valid = true;
            if (friendly) {
                coords.y -= 1;
                if (coords.y < 0) {
                    valid = false;
                    if (this.hasHitEnemy(coords.x)) {
                        this.enemy_life -= 1;
                        this.score += this.points_per_hit;
                        this.playGameSound('enemy_hit');
                        this.updateEnemyPyramidHealth();
                        this.updateStats();
                    }
                    this.hideAmmoPyramid(ammo_id);
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
                        this.updatePyramidHealth();
                    }
                    this.hideAmmoPyramid(ammo_id);
                }

            }

            if (valid) {
                coordinates[this.xy(coords.x, coords.y)] = {
                    friendly: friendly,
                    id: ammo_id
                }
            }
        }

        this[coords_type] = coordinates;
    },

    updateStats: function () {
        var stats = ['score', 'lives', 'kills'], stats_n = 0, item_index = 0, item = stats[item_index], text, $item;

        this.$stats_container.innerHTML = '';
        for (var n = 0; n < this.columns; n++) {
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
        keys_pressed[this .go_left] = false;
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
            this.movePyramid();
        }
        if (keyCode == this.go_right) {
            this.ship_x += 1;
            var ship_max = this.columns - this.ship_width;
            if (this.current_level == 2) {
                ship_max -= 1;
            }
            this.ship_x = Math.min(this.ship_x, ship_max);
            this.movePyramid();
        }
        if (keyCode == this.fire_ammo) {
            this.fireAmmo();
        }
    },

    buildAmmoGrid: function () {
        var i, n, text, $row, $item, $arrow, ammo, friendly, class_name;
        this.$ammo_container.innerHTML = '';

        for (i = 0; i <= (this.rows); i++) {
            $row = this.createElement('div', 'row ammo-grid clearfix');
            for (n = 0; n < this.columns; n++) {
                ammo = this.ammo_coordinates[this.xy(n, i)] || this.enemy_ammo_coordinates[this.xy(n, i)];
                friendly = ammo != null && ammo.friendly == true
                text = ammo == null ? this.off : (friendly ? this.ship_ammo : this.enemy_ammo);
                class_name = ammo == null ? 'item empty-space' : (friendly ? 'item ammo friendly' : 'item ammo enemy');
                $item = this.createElement('div', class_name, text);
                if (ammo) {
                    $arrow = this.createElement('div', 'arrow');
                    $item.appendChild($arrow);
                }
                $row.appendChild($item);
                if (ammo != null) {
                    this.moveAmmoPyramid(ammo.id, n, i);
                }
            }
            this.$ammo_container.appendChild($row);
        }
    },

    buildShip: function () {
        var ship = this.shipAtX(), x, y, $row, ship_piece = 0;
        this.$ship_container.innerHTML = '';

        for (y = 0; y < ship.length; y++) {
            $row = this.createElement('div', 'row ship-row clearfix');
            ship_piece = 0;
            for (x = 0; x < ship[0].length; x++) {
                $item = this.createElement('div', 'item', ship[y][x]);
                if (ship[y][x] == this.on || ship[y][x] == this.between) {
                    $item.className += ' ship';
                    var $arrow = this.createElement('div', 'ship-arrow arrow');
                    $item.appendChild($arrow);
                    if (ship_piece == 0 && y == 0 && this.current_level == 2) {
                        var $big_arrow = this.createElement('div', 'big-arrow');
                        $item.appendChild($big_arrow);
                    }
                    if (ship_piece % 2 == 0) {
                        $item.className += ' even-ship';
                    } else {
                        $item.className += ' odd-ship';
                    }

                    if (ship[y][x] == this.between) {
                        $item.className += ' missing-piece';
                    }
                    ship_piece += 1;
                } else {
                    $item.className += ' empty-space';
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
            for (n = 0; n < this.columns; n++) {
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
        this.ammo_id += 1;
        if (this.current_level >= 3) {
            this.buildAmmoPyramid(this.ammo_id, true);
        }
        this.ammo_coordinates[this.xy(ammo_x, ammo_y)] = {
            friendly: true,
            id: this.ammo_id
        };
        this.playGameSound('player_fire');
    },

    buildEnemy: function () {
        var enemy = this.enemyAtX(), x, y, $row, $item, $arrow, enemy_piece = 0;
        this.$enemy_container.innerHTML = '';

        for (y = 0; y < enemy.length; y++) {
            $row = this.createElement('div', 'row enemy-row clearfix');
            enemy_piece = 0;
            for (x = 0; x < enemy[0].length; x++) {
                $item = this.createElement('div', 'item', enemy[y][x]);
                if (enemy[y][x] == this.on || enemy[y][x] == this.between) {
                    $item.className += ' enemy';
                    $arrow = this.createElement('div', 'ship-arrow arrow');
                    $item.appendChild($arrow);
                    if (enemy_piece == 0 && y == enemy.length - 1) {
                        var $big_arrow = this.createElement('div', 'big-arrow');
                        $item.appendChild($big_arrow);
                    }
                    if (enemy_piece % 2 == 0) {
                        $item.className += ' even-enemy';
                    } else {
                        $item.className += ' odd-enemy';
                    }

                    if (enemy[y][x] == this.between) {
                        $item.className += ' missing-piece';
                    }
                    enemy_piece += 1;
                } else {
                    $item.className += ' empty-space';
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
            for (n = 0; n < this.columns; n++) {
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
        this.ammo_id += 1;
        if (this.current_level >= 3) {
            this.buildAmmoPyramid(this.ammo_id, false);
        }
        this.enemy_ammo_coordinates[this.xy(ammo_x, ammo_y)] = {
            friendly: false,
            id: this.ammo_id
        };
        this.playGameSound('enemy_fire');
    },

    restartEnemy: function () {
        this.playGameSound('enemy_death');
        this.enemy_life = this.enemy_max_life;
        this.updateEnemyPyramidHealth();
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
    },

    buildFriendlyPyramid: function() {
        this.$pyramid_outer = this.createElement('div', 'pyramid-outer');
        this.appendPyramidContent(this.$pyramid_outer);
        this.$container.appendChild(this.$pyramid_outer);
    },

    buildEnemyPyramid: function() {
        this.$enemy_pyramid_outer = this.createElement('div', 'pyramid-outer enemy-pyramid');
        this.appendPyramidContent(this.$enemy_pyramid_outer);
        this.$container.appendChild(this.$enemy_pyramid_outer);
    },

    buildAmmoPyramid: function(id, friendly) {
        var class_name = (friendly) ? 'friendly-ammo-pyramid' : 'enemy-ammo-pyramid';
        var ammo_pyramid_outer = this.createElement('div', 'pyramid-outer ammo-pyramid');
        ammo_pyramid_outer.id = "ammo-" + id;
        ammo_pyramid_outer.className += ' ' + class_name;
        ammo_pyramid_outer.style.display = 'none';
        this.appendPyramidContent(ammo_pyramid_outer);
        this.$container.appendChild(ammo_pyramid_outer);
    },

    moveAmmoPyramid: function(id, x, y) {
        var $pyramid = document.getElementById('ammo-' + id);
        if ($pyramid) {
            $pyramid.style.display = 'block';
            $pyramid.style.left = (x * 12) + 'px';
            $pyramid.style.top = (y * 12) + 'px';
        }
    },

    hideAmmoPyramid: function(id) {
        var $pyramid = document.getElementById('ammo-' + id);
        if ($pyramid) {
            $pyramid.className += ' hide-forever';
        }
    },

    movePyramid: function() {
        if (this.$pyramid_outer != null) {
            this.$pyramid_outer.style.left = ((this.ship_x * 12)) + 'px';
        }
    },

    moveEnemyPyramid: function() {
        if (this.$enemy_pyramid_outer != null) {
            this.$enemy_pyramid_outer.style.left = ((this.enemy_x * 12)) + 'px';
        }
    },

    appendPyramidContent: function($parent) {
        var $pyramid = this.createElement('div', 'pyramid rotates');
        var $pyramid_inner = this.createElement('div', 'pyramid-inner');
        var $pyramid_base = this.createElement('div', 'pyramid-base');
        var $pyramid_face1 = this.createElement('div', 'pyramid-face');
        var $pyramid_face2 = this.createElement('div', 'pyramid-face');
        var $pyramid_face3 = this.createElement('div', 'pyramid-face');
        var $pyramid_face4 = this.createElement('div', 'pyramid-face');
        $pyramid_inner.appendChild($pyramid_base);
        $pyramid_inner.appendChild($pyramid_face1);
        $pyramid_inner.appendChild($pyramid_face2);
        $pyramid_inner.appendChild($pyramid_face3);
        $pyramid_inner.appendChild($pyramid_face4);
        $pyramid.appendChild($pyramid_inner);
        $parent.appendChild($pyramid);
    },

    updateEnemyPyramidHealth: function() {
        if (this.$enemy_pyramid_outer != null) {
            this.$enemy_pyramid_outer.style.opacity = ((this.enemy_life * (100/this.enemy_max_life )) / 100).toString();
        }
    },

    updatePyramidHealth: function() {
        if (this.$pyramid_outer != null) {
            this.$pyramid_outer.style.opacity = ((this.ship_life * (100/this.ship_max_life )) / 100).toString();
        }
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
            y: parseInt(parts[1], 10),
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