open Js
open Dom_html

external reg : string -> ('a -> 'b) -> unit = "register_ocaml_fn"
external stdout : string -> unit = "gloc_stdout"
external stderr : string -> unit = "gloc_stderr"
external stdin  : unit -> js_string t = "gloc_stdin"
external fs_read : string -> string = "gloc_fs_read"
external fs_write : string -> string -> unit = "gloc_fs_write"

module Platform_js = struct
  let id = `JS
  let get_year () = (jsnew date_now ())##getFullYear ()
  let eprint = stderr
  let out_of_filename fn fdf =
    let b = Buffer.create 1024 in
    let r = fdf b in
    (if fn="-" then stdout else fs_write fn) (Buffer.contents b);
    r
  let in_of_filename fn fdf = fdf (fs_read fn)
end

module Gloc_js = Gloc.Make(Platform_js)
open Gloc_js

let gloc args =
  let args = Array.map to_string (to_array args) in
  let args = Array.of_list ("gloc"::(Array.to_list args)) in
  let exec_state = Gloc_lib.new_exec_state (Gloc_js.default_meta) in
  let (specs, anon) = arg_of_cli exec_state Gloc.cli in
  let () = Arg.parse_argv args specs anon Gloc.usage_msg in
  begin try gloc exec_state (fun () -> to_string (stdin ()))
    with Gloc.Exit c -> window##alert(string ("Exit code: "^(string_of_int c)))
  end (* FIXME *)
;;
reg "gloc" gloc
