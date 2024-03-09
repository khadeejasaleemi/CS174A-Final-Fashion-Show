import {defs, tiny} from './examples/common.js';

const {
    Vector, Vector3, vec, vec3, vec4, color, hex_color, Shader, Matrix, Mat4, Light, Shape, Material, Scene,
} = tiny;


export class Assignment3 extends Scene {
    constructor() {
        // constructor(): Scenes begin by populating initial values like the Shapes and Materials they'll need.
        super();

        // At the beginning of our program, load one of each of these shape definitions onto the GPU.
        this.shapes = {
            torus: new defs.Torus(15, 15),
            torus2: new defs.Torus(3, 15),
            sphere: new defs.Subdivision_Sphere(4),
            sphere1: new (defs.Subdivision_Sphere.prototype.make_flat_shaded_version())(1),
            sphere2: new (defs.Subdivision_Sphere.prototype.make_flat_shaded_version())(2),
            sphere3: new defs.Subdivision_Sphere(3),
            circle: new defs.Regular_2D_Polygon(1, 15),
            ring: new defs.Torus(50, 50),
            rectangle: new defs.Cube(),
            cylinder: new defs.Cylindrical_Tube(),
            triangle: new defs.Triangle(),

            // TODO:  Fill in as many additional shape instances as needed in this key/value table.
            //        (Requirement 1)
        };

        // *** Materials
        this.materials = {
            test: new Material(new defs.Phong_Shader(),
                {ambient: .4, diffusivity: .6, color: hex_color("#ffffff")}),
            test2: new Material(new Gouraud_Shader(),
                {ambient: .4, diffusivity: .6, color: hex_color("#992828")}),
            // TODO:  Fill in as many additional material objects as needed in this key/value table.
            //        (Requirement 4)


        }
        this.position_horizontal = 0;
        this.initial_camera_location = Mat4.look_at(vec3(0, 10, 20), vec3(0, 0, 0), vec3(0, 1, 0));
    }


    get_random_color() {
        const red = Math.floor(Math.random() * 256);
        const green = Math.floor(Math.random() * 256);
        const blue = Math.floor(Math.random() * 256);
        return "#" + ((1 << 24) + (red << 16) + (green << 8) + blue).toString(16).slice(1);

    }

    make_control_panel() {
        // Draw the scene's buttons, setup their actions and keyboard shortcuts, and monitor live measurements.
        this.key_triggered_button("Change Shirt Color", ["s"], () => {
            // TODO:  Requirement 5b:  Set a flag here that will toggle your outline on and off
            this.random_shirt = true;
            this.random_shirt_color= this.get_random_color();
        });
        this.key_triggered_button("Change Pant Color", ["p"], () => {
            // TODO:  Requirement 5b:  Set a flag here that will toggle your outline on and off
            this.random_pant = true;
            this.random_pant_color= this.get_random_color();
        });
        this.key_triggered_button("Add hat", ["h"], () => {
            // TODO:  Requirement 5b:  Set a flag here that will toggle your outline on and off
            this.hat= !this.hat;
        });

        this.key_triggered_button("Move right", ["r"], () => {
            // TODO:  Requirement 5b:  Set a flag here that will toggle your outline on and off
            this.position_horizontal += 1;
        });

        this.key_triggered_button("Move left", ["r"], () => {
            // TODO:  Requirement 5b:  Set a flag here that will toggle your outline on and off
            this.position_horizontal -= 1;
        });




    }

    display(context, program_state) {
        // display():  Called once per frame of animation.
        // Setup -- This part sets up the scene's overall camera matrix, projection matrix, and lights:
        if (!context.scratchpad.controls) {
            this.children.push(context.scratchpad.controls = new defs.Movement_Controls());
            // Define the global camera and projection matrices, which are stored in program_state.
            program_state.set_camera(this.initial_camera_location);
        }

        program_state.projection_transform = Mat4.perspective(
            Math.PI / 4, context.width / context.height, .1, 1000);


        // Sine wave method
        // Calculate the radius using a scaled and offset sine function
        const t = program_state.animation_time / 1000, dt = program_state.animation_delta_time / 1000;
        const animation_duration = 7;

        let radius = 1; // Minimum radius
        let col = hex_color("#" + "ffffff");
        let skin_color = hex_color("#C68863");

        // TODO: Lighting (Requirement 2)
        const light_position = vec4(0, 0, 0, 0);

        // The parameters of the Light are: position, color, size
        program_state.lights = [new Light(light_position, col, radius)];


        let head_transform = Mat4.identity().times(Mat4.scale(radius, radius, radius)); // Scale the sphere
        head_transform = head_transform.times(Mat4.translation(0, 2, 0));
        this.shapes.sphere.draw(
            context,
            program_state,
            head_transform.times(Mat4.translation(this.position_horizontal,0,0)),
            this.materials.test.override({ambient: 1, color: skin_color}) // Use maximum ambient and calculated color
        );

        // Define the transformation for the nose
        // const nose_transform = head_transform.times(Mat4.translation(0, -0.2, radius)); // Translate the nose below the head

// Draw the nose using a tetrahedron shape
        /*
        this.shapes.triangle.draw(
            context,
            program_state,
            nose_transform.times(Mat4.scale(0.2, 0.2, 0.2)), // Scale the nose
            this.materials.test.override({ ambient: 1, color: hex_color("#8B4513") }) // Use maximum ambient and specified nose color
        );
         */


        const eye_color = hex_color("#000000");

        // Define the transformation for the eyes
        const eye_radius = 0.1; // Radius of the eyes
        const eye_offset = 0.25; // Offset of the eyes from the center of the head

// Define the transformations for the left and right eyes
        const left_eye_transform = head_transform.times(Mat4.translation(-eye_offset, 0, radius)); // Translate left eye
        const right_eye_transform = head_transform.times(Mat4.translation(eye_offset, 0, radius)); // Translate right eye

// Draw the left eye
        this.shapes.sphere.draw(
            context,
            program_state,
            left_eye_transform.times(Mat4.scale(eye_radius, eye_radius, eye_radius)), // Scale the eye
            this.materials.test.override({ambient: 1, color: eye_color}) // Use maximum ambient and specified eye color
        );

// Draw the right eye
        this.shapes.sphere.draw(
            context,
            program_state,
            right_eye_transform.times(Mat4.scale(eye_radius, eye_radius, eye_radius)), // Scale the eye
            this.materials.test.override({ambient: 1, color: eye_color}) // Use maximum ambient and specified eye color
        );

        // Define the color for the white circle (white)
        const white_color = hex_color("#FFFFFF");


// Draw the left white circle
        this.shapes.circle.draw(
            context,
            program_state,
            left_eye_transform.times(Mat4.scale(0.2, 0.15, 0)).times(Mat4.translation(this.position_horizontal,0,0)),// Scale the circle
            this.materials.test.override({ambient: 1, color: white_color}) // Use maximum ambient and white circle color
        );

        this.shapes.circle.draw(
            context,
            program_state,
            right_eye_transform.times(Mat4.scale(0.2, 0.15, 0)).times(Mat4.translation(this.position_horizontal,0,0)),// Scale the circle
            this.materials.test.override({ambient: 1, color: white_color}) // Use maximum ambient and white circle color
        );


        const smile_transform = head_transform.times(Mat4.translation(0, -0.4, radius - 0.05)); // Translate the smile

// Draw the smile curve (bottom half of torus)

        this.shapes.torus.draw(
            context,
            program_state,
            smile_transform.times(Mat4.scale(0.3, 0.1, 0.2)), // Scale the smile to flatten it
            this.materials.test.override({ambient: 1, color: hex_color("#FF0000")}) // Use maximum ambient and red smile color
        );

        let hat_transform = head_transform.times((Mat4.translation(0, 0.5, 0)));


        if(this.hat) {
            this.shapes.sphere.draw(
                context,
                program_state,
                hat_transform.times(Mat4.scale(1.2, 0, 1.2)),
                this.materials.test.override({ambient: 1, color: col}) // Use maximum ambient and calculated color
            );
        }


        let hat_bottom_transform = hat_transform.times(Mat4.scale(1.2, 0.6, 1.2)); // Same scale as the top of the hat

        if(this.hat) {
            this.shapes.sphere.draw(
                context,
                program_state,
                hat_bottom_transform,
                this.materials.test.override({ambient: 1, color: col}) // Use maximum ambient and calculated color
            );
        }

        let body_transform = Mat4.identity().times(Mat4.scale(1,1,0.4));
        let body_color = hex_color("#0000FF");
        if(this.random_shirt){
            body_color = hex_color(this.random_shirt_color);
        }


        this.shapes.rectangle.draw(
            context,
            program_state,
            body_transform,
            this.materials.test.override({ ambient:1, color:body_color}) // Use maximum ambient and calculated color
        );

        let neck_transform = body_transform.times(Mat4.translation(0,1,0)).times(Mat4.scale(0.3,0.3,1))
        this.shapes.rectangle.draw(
            context,
            program_state,
            neck_transform,
            this.materials.test.override({ ambient:1, color:skin_color}) // Use maximum ambient and calculated color
        );


        let leg_transform1 = Mat4.translation(0.5,-2.2,0).times(Mat4.scale(0.4,1.2,1));
        let leg_transform2 = Mat4.translation(-0.5,-2.2,0).times(Mat4.scale(0.4,1.2,1));


        let leg_color= col;
        if(this.random_pant){
            leg_color = hex_color(this.random_pant_color);
        }

        this.shapes.rectangle.draw(
            context,
            program_state,
            leg_transform1.times(body_transform),
            this.materials.test.override({ ambient:1, color:leg_color}) // Use maximum ambient and calculated color
        );



        this.shapes.rectangle.draw(
            context,
            program_state,
            leg_transform2.times(body_transform),
            this.materials.test.override({ ambient:1, color:leg_color}) // Use maximum ambient and calculated color
        );

        const arm_length = 1.5; // Length of the arm
        const arm_angle = Math.PI / 4; // Angle of the arm (45 degrees)
        const arm_left = Mat4.translation(-1.35,0.15,0).times(Mat4.rotation(-arm_angle, 0, 0, 1). times(Mat4.scale(0.35,0.8,1)));
        const arm_right = Mat4.translation(1.35,0.15,0).times(Mat4.rotation(arm_angle, 0, 0, 1). times(Mat4.scale(0.3,0.8,1)));
        //const arm_translation1 = arm.times(Mat4.translation(-1.5, -1.5, 0).times(Mat4.rotation(arm_angle, 0, 1, 0)));
        //const arm_translation2 = arm.times(Mat4.translation(1.5, -1.5, 0).times(Mat4.rotation(-arm_angle, 0, 1, 0)));


        this.shapes.rectangle.draw(
            context,
            program_state,
            body_transform.times(arm_left), // Apply arm transformation relative to the body
            this.materials.test.override({ ambient: 1, color: skin_color }) // Use maximum ambient and calculated color
        );

        this.shapes.rectangle.draw(
            context,
            program_state,
            body_transform.times(arm_right), // Apply arm transformation relative to the body
            this.materials.test.override({ ambient: 1, color: skin_color }) // Use maximum ambient and calculated color
        );



//
        // Define transformations for the left and right shoes
        const left_shoe_transform = Mat4.translation(-0.55, -3.2, 0.1).times(Mat4.scale(0.5, 0.2, 0.8));
        const right_shoe_transform = Mat4.translation(0.55, -3.2, 0.1).times(Mat4.scale(0.5, 0.2, 0.8));

// Draw the left shoe
        this.shapes.rectangle.draw(
            context,
            program_state,
            left_shoe_transform,
            this.materials.test.override({ ambient: 1, color: hex_color("#663300") }) // Use maximum ambient and shoe color
        );

// Draw the right shoe
        this.shapes.rectangle.draw(
            context,
            program_state,
            right_shoe_transform,
            this.materials.test.override({ ambient: 1, color: hex_color("#663300") }) // Use maximum ambient and shoe color
        );





        let desired;
        if(this.attached && this.attached() !== null) {
            desired = Mat4.inverse(this.attached().times(Mat4.translation(0, 0, 5)));
            desired.map((x,i) => Vector.from(program_state.camera_inverse[i]).mix(x, 0.1));
            program_state.set_camera(desired);
        }
        else{
            desired = this.initial_camera_location;
        }


    }
}

class Gouraud_Shader extends Shader {
    // This is a Shader using Phong_Shader as template
    // TODO: Modify the glsl coder here to create a Gouraud Shader (Planet 2)

    constructor(num_lights = 2) {
        super();
        this.num_lights = num_lights;
    }

    shared_glsl_code() {
        // ********* SHARED CODE, INCLUDED IN BOTH SHADERS *********
        return ` 
        precision mediump float;
        const int N_LIGHTS = ` + this.num_lights + `;
        uniform float ambient, diffusivity, specularity, smoothness;
        uniform vec4 light_positions_or_vectors[N_LIGHTS], light_colors[N_LIGHTS];
        uniform float light_attenuation_factors[N_LIGHTS];
        uniform vec4 shape_color;
        uniform vec3 squared_scale, camera_center;

        // Specifier "varying" means a variable's final value will be passed from the vertex shader
        // on to the next phase (fragment shader), then interpolated per-fragment, weighted by the
        // pixel fragment's proximity to each of the 3 vertices (barycentric interpolation).
        varying vec3 N, vertex_worldspace;
        varying vec4 vertex_color;
        
        // ***** PHONG SHADING HAPPENS HERE: *****            
                                   
        vec3 phong_model_lights( vec3 N, vec3 vertex_worldspace ){                                        
            // phong_model_lights():  Add up the lights' contributions.
            vec3 E = normalize( camera_center - vertex_worldspace );
            vec3 result = vec3( 0.0 );
            for(int i = 0; i < N_LIGHTS; i++){
                // Lights store homogeneous coords - either a position or vector.  If w is 0, the 
                // light will appear directional (uniform direction from all points), and we 
                // simply obtain a vector towards the light by directly using the stored value.
                // Otherwise if w is 1 it will appear as a point light -- compute the vector to 
                // the point light's location from the current surface point.  In either case, 
                // fade (attenuate) the light as the vector needed to reach it gets longer.  
                vec3 surface_to_light_vector = light_positions_or_vectors[i].xyz - 
                                               light_positions_or_vectors[i].w * vertex_worldspace;                                             
                float distance_to_light = length( surface_to_light_vector );

                vec3 L = normalize( surface_to_light_vector );
                vec3 H = normalize( L + E );
                // Compute the diffuse and specular components from the Phong
                // Reflection Model, using Blinn's "halfway vector" method:
                float diffuse  =      max( dot( N, L ), 0.0 );
                float specular = pow( max( dot( N, H ), 0.0 ), smoothness );
                float attenuation = 1.0 / (1.0 + light_attenuation_factors[i] * distance_to_light * distance_to_light );
                
                vec3 light_contribution = shape_color.xyz * light_colors[i].xyz * diffusivity * diffuse
                                                          + light_colors[i].xyz * specularity * specular;
                result += attenuation * light_contribution;
            }
            return result;
        } `;
    }

    vertex_glsl_code() {
        // ********* VERTEX SHADER *********
        return this.shared_glsl_code() + `
            attribute vec3 position, normal;                            
            // Position is expressed in object coordinates.
            
            uniform mat4 model_transform;
            uniform mat4 projection_camera_model_transform;
    
            void main(){                                                                   
                // The vertex's final resting place (in NDCS):
                gl_Position = projection_camera_model_transform * vec4( position, 1.0 );
                // The final normal vector in screen space.
                N = normalize( mat3( model_transform ) * normal / squared_scale);
                vertex_worldspace = ( model_transform * vec4( position, 1.0 ) ).xyz;
                
                vertex_color = vec4(shape_color.xyz * ambient, shape_color.w);
                vertex_color.xyz += phong_model_lights(N, vertex_worldspace);
            } `;
    }

    fragment_glsl_code() {
        // ********* FRAGMENT SHADER *********
        // A fragment is a pixel that's overlapped by the current triangle.
        // Fragments affect the final image or get discarded due to depth.
        return this.shared_glsl_code() + `
            void main(){
                gl_FragColor = vertex_color;
                return;
            } `;
    }

    /*
    void main(){
                // Compute an initial (ambient) color:
                gl_FragColor = vec4( shape_color.xyz * ambient, shape_color.w );
                // Compute the final color with contributions from lights:
                gl_FragColor.xyz += phong_model_lights( normalize( N ), vertex_worldspace );
            }
     */

    send_material(gl, gpu, material) {
        // send_material(): Send the desired shape-wide material qualities to the
        // graphics card, where they will tweak the Phong lighting formula.
        gl.uniform4fv(gpu.shape_color, material.color);
        gl.uniform1f(gpu.ambient, material.ambient);
        gl.uniform1f(gpu.diffusivity, material.diffusivity);
        gl.uniform1f(gpu.specularity, material.specularity);
        gl.uniform1f(gpu.smoothness, material.smoothness);
    }

    send_gpu_state(gl, gpu, gpu_state, model_transform) {
        // send_gpu_state():  Send the state of our whole drawing context to the GPU.
        const O = vec4(0, 0, 0, 1), camera_center = gpu_state.camera_transform.times(O).to3();
        gl.uniform3fv(gpu.camera_center, camera_center);
        // Use the squared scale trick from "Eric's blog" instead of inverse transpose matrix:
        const squared_scale = model_transform.reduce(
            (acc, r) => {
                return acc.plus(vec4(...r).times_pairwise(r))
            }, vec4(0, 0, 0, 0)).to3();
        gl.uniform3fv(gpu.squared_scale, squared_scale);
        // Send the current matrices to the shader.  Go ahead and pre-compute
        // the products we'll need of the of the three special matrices and just
        // cache and send those.  They will be the same throughout this draw
        // call, and thus across each instance of the vertex shader.
        // Transpose them since the GPU expects matrices as column-major arrays.
        const PCM = gpu_state.projection_transform.times(gpu_state.camera_inverse).times(model_transform);
        gl.uniformMatrix4fv(gpu.model_transform, false, Matrix.flatten_2D_to_1D(model_transform.transposed()));
        gl.uniformMatrix4fv(gpu.projection_camera_model_transform, false, Matrix.flatten_2D_to_1D(PCM.transposed()));

        // Omitting lights will show only the material color, scaled by the ambient term:
        if (!gpu_state.lights.length)
            return;

        const light_positions_flattened = [], light_colors_flattened = [];
        for (let i = 0; i < 4 * gpu_state.lights.length; i++) {
            light_positions_flattened.push(gpu_state.lights[Math.floor(i / 4)].position[i % 4]);
            light_colors_flattened.push(gpu_state.lights[Math.floor(i / 4)].color[i % 4]);
        }
        gl.uniform4fv(gpu.light_positions_or_vectors, light_positions_flattened);
        gl.uniform4fv(gpu.light_colors, light_colors_flattened);
        gl.uniform1fv(gpu.light_attenuation_factors, gpu_state.lights.map(l => l.attenuation));
    }

    update_GPU(context, gpu_addresses, gpu_state, model_transform, material) {
        // update_GPU(): Define how to synchronize our JavaScript's variables to the GPU's.  This is where the shader
        // recieves ALL of its inputs.  Every value the GPU wants is divided into two categories:  Values that belong
        // to individual objects being drawn (which we call "Material") and values belonging to the whole scene or
        // program (which we call the "Program_State").  Send both a material and a program state to the shaders
        // within this function, one data field at a time, to fully initialize the shader for a draw.

        // Fill in any missing fields in the Material object with custom defaults for this shader:
        const defaults = {color: color(0, 0, 0, 1), ambient: 0, diffusivity: 1, specularity: 1, smoothness: 40};
        material = Object.assign({}, defaults, material);

        this.send_material(context, gpu_addresses, material);
        this.send_gpu_state(context, gpu_addresses, gpu_state, model_transform);
    }
}

class Ring_Shader extends Shader {
    update_GPU(context, gpu_addresses, graphics_state, model_transform, material) {
        // update_GPU():  Defining how to synchronize our JavaScript's variables to the GPU's:
        const [P, C, M] = [graphics_state.projection_transform, graphics_state.camera_inverse, model_transform],
            PCM = P.times(C).times(M);
        context.uniformMatrix4fv(gpu_addresses.model_transform, false, Matrix.flatten_2D_to_1D(model_transform.transposed()));
        context.uniformMatrix4fv(gpu_addresses.projection_camera_model_transform, false,
            Matrix.flatten_2D_to_1D(PCM.transposed()));
    }

    shared_glsl_code() {
        // ********* SHARED CODE, INCLUDED IN BOTH SHADERS *********
        return `
        precision mediump float;
        varying vec4 point_position;
        varying vec4 center;
        `;
    }

    vertex_glsl_code() {
        // ********* VERTEX SHADER *********
        // TODO:  Complete the main function of the vertex shader (Extra Credit Part II).
        return this.shared_glsl_code() + `
        attribute vec3 position;
        uniform mat4 model_transform;
        uniform mat4 projection_camera_model_transform;
        
        void main(){
          point_position = model_transform * vec4(position,1.0);
          center = model_transform * vec4(0.0, 0.0, 0.0, 1.0);
          gl_Position = projection_camera_model_transform * vec4(position, 1.0); 
        }`;
    }

    fragment_glsl_code() {
        // ********* FRAGMENT SHADER *********
        // TODO:  Complete the main function of the fragment shader (Extra Credit Part II).
        return this.shared_glsl_code() + `
        void main(){
            //hyperparameter 18.01, play around until you get a correct one
            float scalar = sin(18.01 * distance(point_position.xyz, center.xyz));
            //multiply sine by the color of the planet, which are the normalized RGB values
            //#B08040 is the color of the planet
            //Red component: B0(hex) = 176(decimal) / 255 ≈ 0.6078
            //Green component: 80(hex) = 128(decimal) / 255 ≈ 0.3961
            //Blue component: 40(hex) = 64(decimal) / 255 ≈ 0.098
            gl_FragColor = scalar * vec4(0.6078, 0.3961, 0.098, 1.0);
        }`;
    }
}




