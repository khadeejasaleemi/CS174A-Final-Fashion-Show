import {defs, tiny} from './common.js';
import {Body, Test_Data} from "./collisions-demo.js";

// Pull these names into this module's scope for convenience:
const {vec3, unsafe3, vec4, color, Mat4, Light, Shape, Material, Shader, Texture, Scene} = tiny;

export class Shape_From_File extends Shape {                                   // **Shape_From_File** is a versatile standalone Shape that imports
                                                                               // all its arrays' data from an .obj 3D model file.
    constructor(filename) {
        super("position", "normal", "texture_coord");
        // Begin downloading the mesh. Once that completes, return
        // control to our parse_into_mesh function.
        this.load_file(filename);
    }

    load_file(filename) {                             // Request the external file and wait for it to load.
        // Failure mode:  Loads an empty shape.
        return fetch(filename)
            .then(response => {
                if (response.ok) return Promise.resolve(response.text())
                else return Promise.reject(response.status)
            })
            .then(obj_file_contents => this.parse_into_mesh(obj_file_contents))
            .catch(error => {
                this.copy_onto_graphics_card(this.gl);
            })
    }

    parse_into_mesh(data) {                           // Adapted from the "webgl-obj-loader.js" library found online:
        var verts = [], vertNormals = [], textures = [], unpacked = {};

        unpacked.verts = [];
        unpacked.norms = [];
        unpacked.textures = [];
        unpacked.hashindices = {};
        unpacked.indices = [];
        unpacked.index = 0;

        var lines = data.split('\n');

        var VERTEX_RE = /^v\s/;
        var NORMAL_RE = /^vn\s/;
        var TEXTURE_RE = /^vt\s/;
        var FACE_RE = /^f\s/;
        var WHITESPACE_RE = /\s+/;

        for (var i = 0; i < lines.length; i++) {
            var line = lines[i].trim();
            var elements = line.split(WHITESPACE_RE);
            elements.shift();

            if (VERTEX_RE.test(line)) verts.push.apply(verts, elements);
            else if (NORMAL_RE.test(line)) vertNormals.push.apply(vertNormals, elements);
            else if (TEXTURE_RE.test(line)) textures.push.apply(textures, elements);
            else if (FACE_RE.test(line)) {
                var quad = false;
                for (var j = 0, eleLen = elements.length; j < eleLen; j++) {
                    if (j === 3 && !quad) {
                        j = 2;
                        quad = true;
                    }
                    if (elements[j] in unpacked.hashindices)
                        unpacked.indices.push(unpacked.hashindices[elements[j]]);
                    else {
                        var vertex = elements[j].split('/');

                        unpacked.verts.push(+verts[(vertex[0] - 1) * 3 + 0]);
                        unpacked.verts.push(+verts[(vertex[0] - 1) * 3 + 1]);
                        unpacked.verts.push(+verts[(vertex[0] - 1) * 3 + 2]);

                        if (textures.length) {
                            unpacked.textures.push(+textures[((vertex[1] - 1) || vertex[0]) * 2 + 0]);
                            unpacked.textures.push(+textures[((vertex[1] - 1) || vertex[0]) * 2 + 1]);
                        }

                        unpacked.norms.push(+vertNormals[((vertex[2] - 1) || vertex[0]) * 3 + 0]);
                        unpacked.norms.push(+vertNormals[((vertex[2] - 1) || vertex[0]) * 3 + 1]);
                        unpacked.norms.push(+vertNormals[((vertex[2] - 1) || vertex[0]) * 3 + 2]);

                        unpacked.hashindices[elements[j]] = unpacked.index;
                        unpacked.indices.push(unpacked.index);
                        unpacked.index += 1;
                    }
                    if (j === 3 && quad) unpacked.indices.push(unpacked.hashindices[elements[0]]);
                }
            }
        }
        {
            const {verts, norms, textures} = unpacked;
            for (var j = 0; j < verts.length / 3; j++) {
                this.arrays.position.push(vec3(verts[3 * j], verts[3 * j + 1], verts[3 * j + 2]));
                this.arrays.normal.push(vec3(norms[3 * j], norms[3 * j + 1], norms[3 * j + 2]));
                this.arrays.texture_coord.push(vec(textures[2 * j], textures[2 * j + 1]));
            }
            this.indices = unpacked.indices;
        }
        this.normalize_positions(false);
        this.ready = true;
    }

    draw(context, program_state, model_transform, material) {               // draw(): Same as always for shapes, but cancel all
        // attempts to draw the shape before it loads:
        if (this.ready)
            super.draw(context, program_state, model_transform, material);
    }


}


export class Control_Demo extends Scene {
    // ** Inertia_Demo** demonstration: This scene lets random initial momentums
    // carry several bodies until they fall due to gravity and bounce.
    constructor() {
        super();
        this.data = new Test_Data();
        this.shapes = {
            face: new Shape_From_File("assets/face.obj"),
            square: new defs.Square(),
        };
        const shader = new defs.Fake_Bump_Map(1);



        this.materials = {
            test: new Material(new defs.Phong_Shader(),
                {ambient: 0.3, diffusivity: 0.5, specularity: 0, color: color(0.878, 0.675, 0.412,1 )}),
            floor: new Material(shader, {color: color(0, 0, 0, 1), ambient: .5, texture: this.data.textures.stars}),
        }

        // The agent
        this.agent = this.shapes.face;
        this.agent_pos = vec3(0, -4, 0);
        this.agent_size = 5.0;

        this.control = {};
        this.control.w = false;
        this.control.a = false;
        this.control.s = false;
        this.control.d = false;
        this.control.space = false;
    }


    make_control_panel() {
        super.make_control_panel();
        this.new_line();
        this.key_triggered_button("Foward", ["Shift", "W"],
            () => this.control.w = true, '#6E6460', () => this.control.w = false);
        this.key_triggered_button("Back",   ["Shift", "S"],
            () => this.control.s = true, '#6E6460', () => this.control.s = false);
        this.key_triggered_button("Left",   ["Shift", "A"],
            () => this.control.a = true, '#6E6460', () => this.control.a = false);
        this.key_triggered_button("Right",  ["Shift", "D"],
            () => this.control.d = true, '#6E6460', () => this.control.d = false);
        this.key_triggered_button("Speed Up",  ["Shift", " "],
            () => this.control.space = true, '#6E6460', () => this.control.space = false);
    }

    update_state(dt) {
        // update_state():  Override the base time-stepping code to say what this particular
        // Control
        let speed = 10.0;
        if (this.control.space)
            speed *= 3;
        if (this.control.w) {
            this.agent_pos[2] -= dt * speed;
        }
        if (this.control.s) {
            this.agent_pos[2] += dt * speed;
        }
        if (this.control.a) {
            this.agent_pos[0] -= dt * speed;
        }
        if (this.control.d) {
            this.agent_pos[0] += dt * speed;
        }
    }

    display(context, program_state) {
        // display(): Draw everything else in the scene besides the moving bodies.


        if (!context.scratchpad.controls) {
            this.children.push(context.scratchpad.controls = new defs.Movement_Controls());
            this.children.push(new defs.Program_State_Viewer());
            program_state.set_camera(Mat4.translation(0, 0, -50));    // Locate the camera here (inverted matrix).
        }
        program_state.projection_transform = Mat4.perspective(Math.PI / 4, context.width / context.height, 1, 500);
        program_state.lights = [new Light(vec4(0, -5, -10, 1), color(1, 1, 1, 1), 100000)];
        // Draw the ground:
        this.shapes.square.draw(context, program_state, Mat4.translation(0, -10, 0)
                .times(Mat4.rotation(Math.PI / 2, 1, 0, 0)).times(Mat4.scale(50, 50, 1)),
            this.materials.floor.override({ambient:.8, texture: this.data.textures.grid}));


        let agent_trans = Mat4.translation(this.agent_pos[0], this.agent_pos[1], this.agent_pos[2]).
            times(Mat4.scale(this.agent_size,this.agent_size,this.agent_size));

        this.agent.draw(context, program_state, agent_trans, this.materials.test);
    }


}