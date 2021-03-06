(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.Satriani = f()}})(function(){var define,module,exports;return (function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
module.exports = {
    Environment: Environment,
    eq: eq
}

const MYSTERIOUS = '__MYSTERIOUS__';

function Environment(parent) {
    this.vars = Object.create(parent ? parent.vars : null);
    this.parent = parent;
    this.output = (parent && parent.output ? parent.output : console.log);
    // Because nodeJS is based on asynchronous IO, there is no built-in console.readline or similar
    // so by default, any input will yield an empty string.
    this.input = (parent && parent.input ? parent.input : () => "")
}

Environment.prototype = {
    extend: function () { return new Environment(this) },
    find_scope: function (name) {
        let scope = this;
        while (scope) {
            if (Object.prototype.hasOwnProperty.call(scope.vars, name)) return scope;
            scope = scope.parent;
        }
    },

    lookup: function (name) {
        if (name in this.vars)
            return this.vars[name];
        throw new Error("Undefined variable " + name);
    },

    assign: function (name, value) {
        // THIS is where we control whether assignment inside a function call
        // can overwrite variables declared in a parent frame.
        let scope = this.find_scope(name);
        return (scope || this).vars[name] = value;
    },

    def: function (name, value) {
        return this.vars[name] = value;
    },

    run: function(program) {
        let result = evaluate(program, this);
        return (result ? result.value : undefined);
    },

    pronoun_alias: null,
}

 function evaluate(tree, env) {
     if (tree == MYSTERIOUS) return(undefined);
     let list = Object.entries(tree)
     for (let i = 0; i < list.length; i++) {
         let node = list[i];
         let type = node[0];
         let expr = node[1];
         switch (type) {
             case "action": return(tree);
             case "list":
                 let result = null;
                 for (let i = 0; i < expr.length; i++) {
                     let next = expr[i];
                     result = evaluate(next, env);
                     if (result && result.action) return (result);
                 }
                 return result;
             case "conditional":
                 if (evaluate(expr.condition, env)) {
                     return evaluate(expr.consequent, env);
                 } else if (expr.alternate) {
                     return evaluate(expr.alternate, env);
                 }
                 return;
             case 'break':
                 return { 'action' : 'break' };
             case 'continue':
                 return { 'action' : 'continue' };
             case "return":
                 return { 'action': 'return', 'value': evaluate(expr.expression, env) };
             case "number":
             case "string":
             case "constant":
                 return (expr);
             case "output":
                 let printable = evaluate(expr, env);
                 if (typeof (printable) == 'undefined') printable = "mysterious";
                 env.output(printable);
                 return;
             case "listen":
                 return env.input();
             case "binary":
                 return binary(expr, env);
             case "lookup":
                 if (expr.variable.pronoun) return env.lookup(env.pronoun_alias);
                 return env.lookup(expr.variable);
             case "assign":
                 let alias = "";
                 let value = evaluate(expr.expression, env);
                 if (expr.variable.pronoun) {
                     alias = env.pronoun_alias;
                 } else {
                     alias = expr.variable;
                     env.pronoun_alias = alias;
                 }
                 env.assign(alias, value);
                 return;
             case "pronoun":
                 return env.lookup(env.pronoun_alias);
             case "blank":
                 return;
             case "increment":
                 let old_increment_value = env.lookup(expr.variable);
                 switch (typeof (old_increment_value)) {
                     case "boolean":
                         if (expr.multiple % 2 != 0) env.assign(expr.variable, !old_increment_value);
                         return;
                     default:
                         env.assign(expr.variable, (old_increment_value + expr.multiple));
                         return;
                 }
                 return;
             case "decrement":
                 let old_decrement_value = env.lookup(expr.variable);
                 switch (typeof (old_decrement_value)) {
                     case "boolean":
                         if (expr.multiple % 2 != 0) env.assign(expr.variable, !old_decrement_value);
                         return;
                     default:
                         env.assign(expr.variable, (old_decrement_value - expr.multiple));
                         return;
                 }
                 return;

             case "while_loop":
                 while_outer: while (evaluate(expr.condition, env)) {
                     let result = evaluate(expr.consequent, env);
                     if (result) switch(result.action) {
                         case 'continue':
                             continue while_outer;
                         case 'break':
                             break while_outer;
                         case 'return':
                             return (result);
                     }
                 }
                 return;
             case "until_loop":
                 until_outer: while (!evaluate(expr.condition, env)) {
                     let result = evaluate(expr.consequent, env);
                     if (result) switch(result.action) {
                         case 'continue':
                             continue until_outer;
                         case 'break':
                             break until_outer;
                         case 'return':
                             return (result);
                     }
                 }
                 return;
             case "comparison":
                 let lhs = evaluate(expr.lhs, env);
                 let rhs = evaluate(expr.rhs, env);
                 switch (expr.comparator) {
                     case "eq":
                         return eq(lhs, rhs);
                     case "ne":
                         return !eq(lhs, rhs);
                     case "lt":
                         return (lhs < rhs);
                     case "le":
                         return (lhs <= rhs);
                     case "ge":
                         return (lhs >= rhs);
                     case "gt":
                         return (lhs > rhs);
                 }
             case "and":
                 return (evaluate(expr.lhs, env) && evaluate(expr.rhs, env));
             case "nor":
                 return (!evaluate(expr.lhs, env) && !evaluate(expr.rhs, env));
             case "or":
                 return (evaluate(expr.lhs, env) || evaluate(expr.rhs, env));
             case "not":
                 return (!evaluate(expr.expression, env));
             case "function":
                 env.assign(expr.name, make_lambda(expr, env));
                 return;
             case "call":
                 let func = env.lookup(expr.name);
                 let func_result = func.apply(null, expr.args.map(arg => evaluate(arg, env)));
                 return (func_result ? func_result.value : undefined);
             default:
                 throw new Error("Sorry - I don't know how to evaluate this: " + JSON.stringify(tree))

         }
     }
 }

 function eq(lhs, rhs) {
     if (typeof(lhs) == 'undefined') return(typeof(rhs) == 'undefined');
     if (typeof(rhs) == 'undefined') return(typeof(lhs) == 'undefined');

     if (typeof(lhs) == 'boolean') return(eq_boolean(lhs, rhs));
     if (typeof(rhs) == 'boolean') return(eq_boolean(rhs, lhs));
     if (typeof(lhs) == 'number') return(eq_number(lhs, rhs));
     if (typeof(rhs) == 'number') return(eq_number(rhs, lhs));

    return lhs == rhs;
 }

 function eq_number(number, other) {
    if (other == null || typeof(other) == 'undefined') return(number === 0);
    return(other == number);
 }

 function eq_boolean(bool, other) {
    // false equals null in Rockstar
    if (other == null) other = false;
    // false equals zero in Rockstar
    if(typeof(other) == 'number') other = (other !== 0);
    if (typeof(other) == 'string') other = (other !== "");
    return (bool == other);
 }

 function make_lambda(expr, env) {
     function lambda() {
         let names = expr.args;
         if (names.length != arguments.length) throw('Wrong number of arguments supplied to function ' + expr.name + ' (' + expr.args + ')');
         let scope = env.extend();
         for (let i = 0; i < names.length; ++i) scope.def(names[i], arguments[i])
         return evaluate(expr.body, scope);
     }

     return lambda;
 }

 function binary(b, env) {
     let l = evaluate(b.left, env);
     let r = evaluate(b.right, env);
     if (typeof(l) == 'undefined') l = 'mysterious';
     if (typeof(r) == 'undefined') r = 'mysterious'
     switch (b.op) {
         case '+':
             return l + r;
         case '-':
             return l - r;
         case '/':
             return l / r;
         case '*':
             return multiply(l, r);
     }
 }
 function multiply(lhs, rhs) {
    // Null, nothing, noone, nowhere, etc. are all zero for multiplication purposes.
    if (rhs == null) rhs = 0;
    if (lhs == null) lhs = 0;
     // Multiplying numbers just works.
     if (typeof (lhs) == 'number' && typeof (rhs) == 'number') return (lhs * rhs);
     // Multiplying strings by numbers does repeated concatenation
     if (typeof (lhs) == 'string' && typeof (rhs) == 'number') return multiply_string(lhs, rhs);
     if (typeof (lhs) == 'number' && typeof (rhs) == 'string') return multiply_string(rhs, lhs);
 }

 function multiply_string(s, n) {
    let result = Array();
    while(--n >= 0) result.push(s);
    return(result.join(''));
}

},{}],2:[function(require,module,exports){
const parser = require('./satriani.parser.js');
const interpreter = require('./satriani.interpreter.js');

module.exports = {
    Interpreter : function() {
        this.run = function(program, input, output) {
            if (typeof(program) == 'string') program = this.parse(program);
            let env = new interpreter.Environment();
            env.output = output || console.log;
            env.input = input || (() => "");
            return env.run(program);
        }

        this.parse = function(program) {
            return parser.parse(program);
        }
    }
};

},{"./satriani.interpreter.js":1,"./satriani.parser.js":3}],3:[function(require,module,exports){
/*
 * Generated by PEG.js 0.10.0.
 *
 * http://pegjs.org/
 */

"use strict";

function peg$subclass(child, parent) {
  function ctor() { this.constructor = child; }
  ctor.prototype = parent.prototype;
  child.prototype = new ctor();
}

function peg$SyntaxError(message, expected, found, location) {
  this.message  = message;
  this.expected = expected;
  this.found    = found;
  this.location = location;
  this.name     = "SyntaxError";

  if (typeof Error.captureStackTrace === "function") {
    Error.captureStackTrace(this, peg$SyntaxError);
  }
}

peg$subclass(peg$SyntaxError, Error);

peg$SyntaxError.buildMessage = function(expected, found) {
  var DESCRIBE_EXPECTATION_FNS = {
        literal: function(expectation) {
          return "\"" + literalEscape(expectation.text) + "\"";
        },

        "class": function(expectation) {
          var escapedParts = "",
              i;

          for (i = 0; i < expectation.parts.length; i++) {
            escapedParts += expectation.parts[i] instanceof Array
              ? classEscape(expectation.parts[i][0]) + "-" + classEscape(expectation.parts[i][1])
              : classEscape(expectation.parts[i]);
          }

          return "[" + (expectation.inverted ? "^" : "") + escapedParts + "]";
        },

        any: function(expectation) {
          return "any character";
        },

        end: function(expectation) {
          return "end of input";
        },

        other: function(expectation) {
          return expectation.description;
        }
      };

  function hex(ch) {
    return ch.charCodeAt(0).toString(16).toUpperCase();
  }

  function literalEscape(s) {
    return s
      .replace(/\\/g, '\\\\')
      .replace(/"/g,  '\\"')
      .replace(/\0/g, '\\0')
      .replace(/\t/g, '\\t')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
      .replace(/[\x00-\x0F]/g,          function(ch) { return '\\x0' + hex(ch); })
      .replace(/[\x10-\x1F\x7F-\x9F]/g, function(ch) { return '\\x'  + hex(ch); });
  }

  function classEscape(s) {
    return s
      .replace(/\\/g, '\\\\')
      .replace(/\]/g, '\\]')
      .replace(/\^/g, '\\^')
      .replace(/-/g,  '\\-')
      .replace(/\0/g, '\\0')
      .replace(/\t/g, '\\t')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
      .replace(/[\x00-\x0F]/g,          function(ch) { return '\\x0' + hex(ch); })
      .replace(/[\x10-\x1F\x7F-\x9F]/g, function(ch) { return '\\x'  + hex(ch); });
  }

  function describeExpectation(expectation) {
    return DESCRIBE_EXPECTATION_FNS[expectation.type](expectation);
  }

  function describeExpected(expected) {
    var descriptions = new Array(expected.length),
        i, j;

    for (i = 0; i < expected.length; i++) {
      descriptions[i] = describeExpectation(expected[i]);
    }

    descriptions.sort();

    if (descriptions.length > 0) {
      for (i = 1, j = 1; i < descriptions.length; i++) {
        if (descriptions[i - 1] !== descriptions[i]) {
          descriptions[j] = descriptions[i];
          j++;
        }
      }
      descriptions.length = j;
    }

    switch (descriptions.length) {
      case 1:
        return descriptions[0];

      case 2:
        return descriptions[0] + " or " + descriptions[1];

      default:
        return descriptions.slice(0, -1).join(", ")
          + ", or "
          + descriptions[descriptions.length - 1];
    }
  }

  function describeFound(found) {
    return found ? "\"" + literalEscape(found) + "\"" : "end of input";
  }

  return "Expected " + describeExpected(expected) + " but " + describeFound(found) + " found.";
};

function peg$parse(input, options) {
  options = options !== void 0 ? options : {};

  var peg$FAILED = {},

      peg$startRuleFunctions = { program: peg$parseprogram },
      peg$startRuleFunction  = peg$parseprogram,

      peg$c0 = function(p) { return { list: p.filter(item => item) } },
      peg$c1 = function(s) { return s },
      peg$c2 = function() { return null },
      peg$c3 = /^[ \t]/,
      peg$c4 = peg$classExpectation([" ", "\t"], false, false),
      peg$c5 = "(",
      peg$c6 = peg$literalExpectation("(", false),
      peg$c7 = /^[^)]/,
      peg$c8 = peg$classExpectation([")"], true, false),
      peg$c9 = ")",
      peg$c10 = peg$literalExpectation(")", false),
      peg$c11 = /^[;,?!&.]/,
      peg$c12 = peg$classExpectation([";", ",", "?", "!", "&", "."], false, false),
      peg$c13 = "\n",
      peg$c14 = peg$literalExpectation("\n", false),
      peg$c15 = /^[^\n]/,
      peg$c16 = peg$classExpectation(["\n"], true, false),
      peg$c17 = "break",
      peg$c18 = peg$literalExpectation("break", true),
      peg$c19 = function() {
      	return { 'break' : {} }
      },
      peg$c20 = "continue",
      peg$c21 = peg$literalExpectation("continue", true),
      peg$c22 = "take it to the top",
      peg$c23 = peg$literalExpectation("take it to the top", true),
      peg$c24 = function() {
      	return { 'continue' : {} }
      },
      peg$c25 = "takes",
      peg$c26 = peg$literalExpectation("takes", true),
      peg$c27 = function(name, args, body) { return { 'function': {
          	name: name,
              args: args.map(arg => arg),
              body: body
          } } },
      peg$c28 = ", and",
      peg$c29 = peg$literalExpectation(", and", false),
      peg$c30 = "and",
      peg$c31 = peg$literalExpectation("and", false),
      peg$c32 = "&",
      peg$c33 = peg$literalExpectation("&", false),
      peg$c34 = ",",
      peg$c35 = peg$literalExpectation(",", false),
      peg$c36 = "'n'",
      peg$c37 = peg$literalExpectation("'n'", false),
      peg$c38 = function(head, tail) { return [head].concat(tail) },
      peg$c39 = function(arg) { return [arg] },
      peg$c40 = "taking",
      peg$c41 = peg$literalExpectation("taking", true),
      peg$c42 = function(name, args) { return { 'call': { name: name, args: args } } },
      peg$c43 = "return",
      peg$c44 = peg$literalExpectation("return", true),
      peg$c45 = "give back",
      peg$c46 = peg$literalExpectation("give back", true),
      peg$c47 = function(e) { return { 'return': { 'expression' : e } } },
      peg$c48 = "listen to",
      peg$c49 = peg$literalExpectation("listen to", true),
      peg$c50 = function(v) { return { 'assign': { 'expression': { 'listen' : ''}, 'variable': v } } },
      peg$c51 = "listen",
      peg$c52 = peg$literalExpectation("listen", true),
      peg$c53 = function() { return { 'listen' : ''} },
      peg$c54 = function(head, tail) {
                return { list : [head].concat(tail) }
              },
      peg$c55 = "else",
      peg$c56 = peg$literalExpectation("else", true),
      peg$c57 = function(a) { return a },
      peg$c58 = "if",
      peg$c59 = peg$literalExpectation("if", true),
      peg$c60 = function(e, c, a) {
                return {
                    'conditional': {
                        'condition' : e,
                          'consequent' : c,
                          'alternate' : a
                      }
                  };
              },
      peg$c61 = "while",
      peg$c62 = peg$literalExpectation("while", true),
      peg$c63 = function(e, c) { return { 'while_loop': {
                  'condition': e,
                  'consequent': c
               } }; },
      peg$c64 = "until",
      peg$c65 = peg$literalExpectation("until", true),
      peg$c66 = function(e, c) { return { 'until_loop': {
                  'condition': e,
                  'consequent': c
               } }; },
      peg$c67 = "say",
      peg$c68 = peg$literalExpectation("say", true),
      peg$c69 = "shout",
      peg$c70 = peg$literalExpectation("shout", true),
      peg$c71 = "whisper",
      peg$c72 = peg$literalExpectation("whisper", true),
      peg$c73 = "scream",
      peg$c74 = peg$literalExpectation("scream", true),
      peg$c75 = function(e) {return {'output': e}},
      peg$c76 = "true",
      peg$c77 = peg$literalExpectation("true", true),
      peg$c78 = "ok",
      peg$c79 = peg$literalExpectation("ok", true),
      peg$c80 = "right",
      peg$c81 = peg$literalExpectation("right", true),
      peg$c82 = "yes",
      peg$c83 = peg$literalExpectation("yes", true),
      peg$c84 = function() { return { constant: true } },
      peg$c85 = "false",
      peg$c86 = peg$literalExpectation("false", true),
      peg$c87 = "lies",
      peg$c88 = peg$literalExpectation("lies", true),
      peg$c89 = "wrong",
      peg$c90 = peg$literalExpectation("wrong", true),
      peg$c91 = "no",
      peg$c92 = peg$literalExpectation("no", true),
      peg$c93 = function() { return { constant: false } },
      peg$c94 = "null",
      peg$c95 = peg$literalExpectation("null", true),
      peg$c96 = "nothing",
      peg$c97 = peg$literalExpectation("nothing", true),
      peg$c98 = "nowhere",
      peg$c99 = peg$literalExpectation("nowhere", true),
      peg$c100 = "nobody",
      peg$c101 = peg$literalExpectation("nobody", true),
      peg$c102 = "empty",
      peg$c103 = peg$literalExpectation("empty", true),
      peg$c104 = "gone",
      peg$c105 = peg$literalExpectation("gone", true),
      peg$c106 = function() { return { constant: null } },
      peg$c107 = "mysterious",
      peg$c108 = peg$literalExpectation("mysterious", false),
      peg$c109 = function() { return '__MYSTERIOUS__' },
      peg$c110 = "-",
      peg$c111 = peg$literalExpectation("-", false),
      peg$c112 = /^[0-9]/,
      peg$c113 = peg$classExpectation([["0", "9"]], false, false),
      peg$c114 = ".",
      peg$c115 = peg$literalExpectation(".", false),
      peg$c116 = function(n) { return {number: parseFloat(n)} },
      peg$c117 = function(n) { return {number: parseFloat(n) } },
      peg$c118 = "\"",
      peg$c119 = peg$literalExpectation("\"", false),
      peg$c120 = /^[^"]/,
      peg$c121 = peg$classExpectation(["\""], true, false),
      peg$c122 = function(s) { return {string: s}},
      peg$c123 = "nor",
      peg$c124 = peg$literalExpectation("nor", false),
      peg$c125 = function(lhs, rhs) {
      	return { 'nor' : { lhs: lhs, rhs: rhs } } },
      peg$c126 = "or",
      peg$c127 = peg$literalExpectation("or", false),
      peg$c128 = function(lhs, rhs) {
      	return { 'or': {
              lhs: lhs,
              rhs: rhs
          } }
       },
      peg$c129 = function(lhs, rhs) {
      	return { 'and': {
              lhs: lhs,
              rhs: rhs
          } }
       },
      peg$c130 = "aint",
      peg$c131 = peg$literalExpectation("aint", true),
      peg$c132 = "ain't",
      peg$c133 = peg$literalExpectation("ain't", true),
      peg$c134 = function() { return 'ne' },
      peg$c135 = "is",
      peg$c136 = peg$literalExpectation("is", true),
      peg$c137 = function() { return 'eq' },
      peg$c138 = function(lhs, c, rhs) {
            return {
                comparison: {
                    comparator: c,
                      lhs: lhs,
                      rhs: rhs
                  }
              };
          },
      peg$c139 = "not",
      peg$c140 = peg$literalExpectation("not", false),
      peg$c141 = function(e) { return { 'not': { expression: e} } },
      peg$c142 = "higher",
      peg$c143 = peg$literalExpectation("higher", true),
      peg$c144 = "greater",
      peg$c145 = peg$literalExpectation("greater", true),
      peg$c146 = "bigger",
      peg$c147 = peg$literalExpectation("bigger", true),
      peg$c148 = "stronger",
      peg$c149 = peg$literalExpectation("stronger", true),
      peg$c150 = "lower",
      peg$c151 = peg$literalExpectation("lower", true),
      peg$c152 = "less",
      peg$c153 = peg$literalExpectation("less", true),
      peg$c154 = "smaller",
      peg$c155 = peg$literalExpectation("smaller", true),
      peg$c156 = "weaker",
      peg$c157 = peg$literalExpectation("weaker", true),
      peg$c158 = "high",
      peg$c159 = peg$literalExpectation("high", true),
      peg$c160 = "great",
      peg$c161 = peg$literalExpectation("great", true),
      peg$c162 = "big",
      peg$c163 = peg$literalExpectation("big", true),
      peg$c164 = "strong",
      peg$c165 = peg$literalExpectation("strong", true),
      peg$c166 = "low",
      peg$c167 = peg$literalExpectation("low", true),
      peg$c168 = "small",
      peg$c169 = peg$literalExpectation("small", true),
      peg$c170 = "weak",
      peg$c171 = peg$literalExpectation("weak", true),
      peg$c172 = "than",
      peg$c173 = peg$literalExpectation("than", true),
      peg$c174 = function() { return 'gt' },
      peg$c175 = function() { return 'lt' },
      peg$c176 = "as",
      peg$c177 = peg$literalExpectation("as", true),
      peg$c178 = function() { return 'ge' },
      peg$c179 = function() { return 'le' },
      peg$c180 = function(first, rest) { return rest.reduce(function(memo, curr) {
                            return { binary: { op: curr[0], left: memo, right: curr[1]} };
                      }, first); },
      peg$c181 = function(first, rest) { return rest.reduce(function(memo, curr) {
                          return { binary: { op: curr[0], left: memo, right: curr[1]} };
                      }, first); },
      peg$c182 = "+",
      peg$c183 = peg$literalExpectation("+", false),
      peg$c184 = "plus ",
      peg$c185 = peg$literalExpectation("plus ", false),
      peg$c186 = "with ",
      peg$c187 = peg$literalExpectation("with ", false),
      peg$c188 = function() { return '+' },
      peg$c189 = "minus ",
      peg$c190 = peg$literalExpectation("minus ", false),
      peg$c191 = "without ",
      peg$c192 = peg$literalExpectation("without ", false),
      peg$c193 = function() { return '-' },
      peg$c194 = "*",
      peg$c195 = peg$literalExpectation("*", false),
      peg$c196 = "times ",
      peg$c197 = peg$literalExpectation("times ", false),
      peg$c198 = "of ",
      peg$c199 = peg$literalExpectation("of ", false),
      peg$c200 = function() { return '*' },
      peg$c201 = "/",
      peg$c202 = peg$literalExpectation("/", false),
      peg$c203 = "over ",
      peg$c204 = peg$literalExpectation("over ", false),
      peg$c205 = "between ",
      peg$c206 = peg$literalExpectation("between ", false),
      peg$c207 = function() { return '/' },
      peg$c208 = "they",
      peg$c209 = peg$literalExpectation("they", true),
      peg$c210 = "them",
      peg$c211 = peg$literalExpectation("them", true),
      peg$c212 = "she",
      peg$c213 = peg$literalExpectation("she", true),
      peg$c214 = "him",
      peg$c215 = peg$literalExpectation("him", true),
      peg$c216 = "her",
      peg$c217 = peg$literalExpectation("her", true),
      peg$c218 = "hir",
      peg$c219 = peg$literalExpectation("hir", true),
      peg$c220 = "zie",
      peg$c221 = peg$literalExpectation("zie", true),
      peg$c222 = "zir",
      peg$c223 = peg$literalExpectation("zir", true),
      peg$c224 = "xem",
      peg$c225 = peg$literalExpectation("xem", true),
      peg$c226 = "ver",
      peg$c227 = peg$literalExpectation("ver", true),
      peg$c228 = "ze",
      peg$c229 = peg$literalExpectation("ze", true),
      peg$c230 = "ve",
      peg$c231 = peg$literalExpectation("ve", true),
      peg$c232 = "xe",
      peg$c233 = peg$literalExpectation("xe", true),
      peg$c234 = "it",
      peg$c235 = peg$literalExpectation("it", true),
      peg$c236 = "he",
      peg$c237 = peg$literalExpectation("he", true),
      peg$c238 = function(pronoun) { return { pronoun: pronoun.toLowerCase() } },
      peg$c239 = function(v) { return { lookup: { variable: v } }; },
      peg$c240 = "an",
      peg$c241 = peg$literalExpectation("an", true),
      peg$c242 = "a",
      peg$c243 = peg$literalExpectation("a", true),
      peg$c244 = "the",
      peg$c245 = peg$literalExpectation("the", true),
      peg$c246 = "my",
      peg$c247 = peg$literalExpectation("my", true),
      peg$c248 = "your",
      peg$c249 = peg$literalExpectation("your", true),
      peg$c250 = /^[A-Z\xC0\xC1\xC2\xC3\xC4\xC5\xC6\xC7\xC8\xC9\xCA\xCB\xCC\xCD\xCE\xCF\xD0\xD1\xD2\xD3\xD4\xD5\xD6\xD8\xD9\xDA\xDB\xDC\xDD\xDE\u0100\u0102\u0104\u0106\u0108\u010A\u010C\u010E\u0110\u0112\u0114\u0116\u0118\u011A\u011C\u011E\u0120\u0122\u0124\u0126\u0128\u012A\u012C\u012E\u0130\u0132\u0134\u0136\u0138\u0139\u013B\u013D\u013F\u0141\u0143\u0145\u0147\u014A\u014C\u014E\u0150\u0152\u0154\u0156\u0158\u015A\u015C\u015E\u0160\u0162\u0164\u0166\u0168\u016A\u016C\u016E\u0170\u0172\u0174\u0176\u0178\u0179\u017B\u017D]/,
      peg$c251 = peg$classExpectation([["A", "Z"], "\xC0", "\xC1", "\xC2", "\xC3", "\xC4", "\xC5", "\xC6", "\xC7", "\xC8", "\xC9", "\xCA", "\xCB", "\xCC", "\xCD", "\xCE", "\xCF", "\xD0", "\xD1", "\xD2", "\xD3", "\xD4", "\xD5", "\xD6", "\xD8", "\xD9", "\xDA", "\xDB", "\xDC", "\xDD", "\xDE", "\u0100", "\u0102", "\u0104", "\u0106", "\u0108", "\u010A", "\u010C", "\u010E", "\u0110", "\u0112", "\u0114", "\u0116", "\u0118", "\u011A", "\u011C", "\u011E", "\u0120", "\u0122", "\u0124", "\u0126", "\u0128", "\u012A", "\u012C", "\u012E", "\u0130", "\u0132", "\u0134", "\u0136", "\u0138", "\u0139", "\u013B", "\u013D", "\u013F", "\u0141", "\u0143", "\u0145", "\u0147", "\u014A", "\u014C", "\u014E", "\u0150", "\u0152", "\u0154", "\u0156", "\u0158", "\u015A", "\u015C", "\u015E", "\u0160", "\u0162", "\u0164", "\u0166", "\u0168", "\u016A", "\u016C", "\u016E", "\u0170", "\u0172", "\u0174", "\u0176", "\u0178", "\u0179", "\u017B", "\u017D"], false, false),
      peg$c252 = /^[a-z\xE0\xE1\xE2\xE3\xE4\xE5\xE6\xE7\xE8\xE9\xEA\xEB\xEC\xED\xEE\xEF\xF0\xF1\xF2\xF3\xF4\xF5\xF6\xF8\xF9\xFA\xFB\xFC\xFD\xFE\u0101\u0103\u0105\u0107\u0109\u010B\u010D\u010F\u0111\u0113\u0115\u0117\u0119\u011B\u011D\u011F\u0121\u0123\u0125\u0127\u0129\u012B\u012D\u012F\u0131\u0133\u0135\u0137\u0138\u013A\u013C\u013E\u0140\u0142\u0144\u0146\u0148\u014B\u014D\u014F\u0151\u0153\u0155\u0157\u0159\u015B\u015D\u015F\u0161\u0163\u0165\u0167\u0169\u016B\u016D\u016F\u0171\u0173\u0175\u0177\xFF\u017A\u017C\u017E\u0149\xDF]/,
      peg$c253 = peg$classExpectation([["a", "z"], "\xE0", "\xE1", "\xE2", "\xE3", "\xE4", "\xE5", "\xE6", "\xE7", "\xE8", "\xE9", "\xEA", "\xEB", "\xEC", "\xED", "\xEE", "\xEF", "\xF0", "\xF1", "\xF2", "\xF3", "\xF4", "\xF5", "\xF6", "\xF8", "\xF9", "\xFA", "\xFB", "\xFC", "\xFD", "\xFE", "\u0101", "\u0103", "\u0105", "\u0107", "\u0109", "\u010B", "\u010D", "\u010F", "\u0111", "\u0113", "\u0115", "\u0117", "\u0119", "\u011B", "\u011D", "\u011F", "\u0121", "\u0123", "\u0125", "\u0127", "\u0129", "\u012B", "\u012D", "\u012F", "\u0131", "\u0133", "\u0135", "\u0137", "\u0138", "\u013A", "\u013C", "\u013E", "\u0140", "\u0142", "\u0144", "\u0146", "\u0148", "\u014B", "\u014D", "\u014F", "\u0151", "\u0153", "\u0155", "\u0157", "\u0159", "\u015B", "\u015D", "\u015F", "\u0161", "\u0163", "\u0165", "\u0167", "\u0169", "\u016B", "\u016D", "\u016F", "\u0171", "\u0173", "\u0175", "\u0177", "\xFF", "\u017A", "\u017C", "\u017E", "\u0149", "\xDF"], false, false),
      peg$c254 = function(prefix, name) { return (prefix + '_' + name).toLowerCase() },
      peg$c255 = "'s",
      peg$c256 = peg$literalExpectation("'s", false),
      peg$c257 = "=",
      peg$c258 = peg$literalExpectation("=", false),
      peg$c259 = "is ",
      peg$c260 = peg$literalExpectation("is ", true),
      peg$c261 = "was ",
      peg$c262 = peg$literalExpectation("was ", true),
      peg$c263 = "are ",
      peg$c264 = peg$literalExpectation("are ", true),
      peg$c265 = "were ",
      peg$c266 = peg$literalExpectation("were ", true),
      peg$c267 = function(v, e) { return { assign: { variable: v, expression: e} }; },
      peg$c268 = "says",
      peg$c269 = peg$literalExpectation("says", true),
      peg$c270 = "put",
      peg$c271 = peg$literalExpectation("put", true),
      peg$c272 = "into",
      peg$c273 = peg$literalExpectation("into", true),
      peg$c274 = function(e, v) { return { assign: { variable: v, expression: e} }; },
      peg$c275 = function(s) { return { string: s} },
      peg$c276 = function(n, d) { return { number: parseFloat(d?n+'.'+d:n)}},
      peg$c277 = function(d) {return d},
      peg$c278 = /^[0-9',;:?!+_\-\/]/,
      peg$c279 = peg$classExpectation([["0", "9"], "'", ",", ";", ":", "?", "!", "+", "_", "-", "/"], false, false),
      peg$c280 = function(head, tail) { return head + tail },
      peg$c281 = function(d) { return d },
      peg$c282 = /^[A-Za-z']/,
      peg$c283 = peg$classExpectation([["A", "Z"], ["a", "z"], "'"], false, false),
      peg$c284 = function(t) { return (t.filter(c => /[A-Za-z]/.test(c)).length%10).toString()},
      peg$c285 = peg$literalExpectation("mysterious", true),
      peg$c286 = "between",
      peg$c287 = peg$literalExpectation("between", true),
      peg$c288 = "without",
      peg$c289 = peg$literalExpectation("without", true),
      peg$c290 = "build",
      peg$c291 = peg$literalExpectation("build", true),
      peg$c292 = "knock",
      peg$c293 = peg$literalExpectation("knock", true),
      peg$c294 = "take ",
      peg$c295 = peg$literalExpectation("take ", true),
      peg$c296 = "times",
      peg$c297 = peg$literalExpectation("times", true),
      peg$c298 = "minus",
      peg$c299 = peg$literalExpectation("minus", true),
      peg$c300 = "back",
      peg$c301 = peg$literalExpectation("back", true),
      peg$c302 = "down",
      peg$c303 = peg$literalExpectation("down", true),
      peg$c304 = "give",
      peg$c305 = peg$literalExpectation("give", true),
      peg$c306 = "plus",
      peg$c307 = peg$literalExpectation("plus", true),
      peg$c308 = "were",
      peg$c309 = peg$literalExpectation("were", true),
      peg$c310 = "over",
      peg$c311 = peg$literalExpectation("over", true),
      peg$c312 = "with",
      peg$c313 = peg$literalExpectation("with", true),
      peg$c314 = peg$literalExpectation("and", true),
      peg$c315 = "it ",
      peg$c316 = peg$literalExpectation("it ", true),
      peg$c317 = peg$literalExpectation("nor", true),
      peg$c318 = peg$literalExpectation("not", true),
      peg$c319 = "top",
      peg$c320 = peg$literalExpectation("top", true),
      peg$c321 = "was",
      peg$c322 = peg$literalExpectation("was", true),
      peg$c323 = "of",
      peg$c324 = peg$literalExpectation("of", true),
      peg$c325 = peg$literalExpectation("or", true),
      peg$c326 = "to",
      peg$c327 = peg$literalExpectation("to", true),
      peg$c328 = "up",
      peg$c329 = peg$literalExpectation("up", true),
      peg$c330 = " ",
      peg$c331 = peg$literalExpectation(" ", false),
      peg$c332 = function(head) { return head.replace(/ /g, '_').toUpperCase()  },
      peg$c333 = function(v, t) { return {
            increment: {
                variable: v,
                  multiple: t.length
              }
          }; },
      peg$c334 = function(v, t) { return {
            decrement: {
                variable: v,
                  multiple: t.length
              }
          }; },

      peg$currPos          = 0,
      peg$savedPos         = 0,
      peg$posDetailsCache  = [{ line: 1, column: 1 }],
      peg$maxFailPos       = 0,
      peg$maxFailExpected  = [],
      peg$silentFails      = 0,

      peg$result;

  if ("startRule" in options) {
    if (!(options.startRule in peg$startRuleFunctions)) {
      throw new Error("Can't start parsing from rule \"" + options.startRule + "\".");
    }

    peg$startRuleFunction = peg$startRuleFunctions[options.startRule];
  }

  function text() {
    return input.substring(peg$savedPos, peg$currPos);
  }

  function location() {
    return peg$computeLocation(peg$savedPos, peg$currPos);
  }

  function expected(description, location) {
    location = location !== void 0 ? location : peg$computeLocation(peg$savedPos, peg$currPos)

    throw peg$buildStructuredError(
      [peg$otherExpectation(description)],
      input.substring(peg$savedPos, peg$currPos),
      location
    );
  }

  function error(message, location) {
    location = location !== void 0 ? location : peg$computeLocation(peg$savedPos, peg$currPos)

    throw peg$buildSimpleError(message, location);
  }

  function peg$literalExpectation(text, ignoreCase) {
    return { type: "literal", text: text, ignoreCase: ignoreCase };
  }

  function peg$classExpectation(parts, inverted, ignoreCase) {
    return { type: "class", parts: parts, inverted: inverted, ignoreCase: ignoreCase };
  }

  function peg$anyExpectation() {
    return { type: "any" };
  }

  function peg$endExpectation() {
    return { type: "end" };
  }

  function peg$otherExpectation(description) {
    return { type: "other", description: description };
  }

  function peg$computePosDetails(pos) {
    var details = peg$posDetailsCache[pos], p;

    if (details) {
      return details;
    } else {
      p = pos - 1;
      while (!peg$posDetailsCache[p]) {
        p--;
      }

      details = peg$posDetailsCache[p];
      details = {
        line:   details.line,
        column: details.column
      };

      while (p < pos) {
        if (input.charCodeAt(p) === 10) {
          details.line++;
          details.column = 1;
        } else {
          details.column++;
        }

        p++;
      }

      peg$posDetailsCache[pos] = details;
      return details;
    }
  }

  function peg$computeLocation(startPos, endPos) {
    var startPosDetails = peg$computePosDetails(startPos),
        endPosDetails   = peg$computePosDetails(endPos);

    return {
      start: {
        offset: startPos,
        line:   startPosDetails.line,
        column: startPosDetails.column
      },
      end: {
        offset: endPos,
        line:   endPosDetails.line,
        column: endPosDetails.column
      }
    };
  }

  function peg$fail(expected) {
    if (peg$currPos < peg$maxFailPos) { return; }

    if (peg$currPos > peg$maxFailPos) {
      peg$maxFailPos = peg$currPos;
      peg$maxFailExpected = [];
    }

    peg$maxFailExpected.push(expected);
  }

  function peg$buildSimpleError(message, location) {
    return new peg$SyntaxError(message, null, null, location);
  }

  function peg$buildStructuredError(expected, found, location) {
    return new peg$SyntaxError(
      peg$SyntaxError.buildMessage(expected, found),
      expected,
      found,
      location
    );
  }

  function peg$parseprogram() {
    var s0, s1, s2;

    s0 = peg$currPos;
    s1 = [];
    s2 = peg$parseline();
    while (s2 !== peg$FAILED) {
      s1.push(s2);
      s2 = peg$parseline();
    }
    if (s1 !== peg$FAILED) {
      peg$savedPos = s0;
      s1 = peg$c0(s1);
    }
    s0 = s1;

    return s0;
  }

  function peg$parseline() {
    var s0, s1, s2, s3, s4;

    s0 = peg$currPos;
    s1 = [];
    s2 = peg$parse_();
    while (s2 !== peg$FAILED) {
      s1.push(s2);
      s2 = peg$parse_();
    }
    if (s1 !== peg$FAILED) {
      s2 = peg$parsestatement();
      if (s2 !== peg$FAILED) {
        s3 = [];
        s4 = peg$parseEOL();
        if (s4 !== peg$FAILED) {
          while (s4 !== peg$FAILED) {
            s3.push(s4);
            s4 = peg$parseEOL();
          }
        } else {
          s3 = peg$FAILED;
        }
        if (s3 !== peg$FAILED) {
          peg$savedPos = s0;
          s1 = peg$c1(s2);
          s0 = s1;
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }
    if (s0 === peg$FAILED) {
      s0 = peg$currPos;
      s1 = peg$parseEOL();
      if (s1 !== peg$FAILED) {
        peg$savedPos = s0;
        s1 = peg$c2();
      }
      s0 = s1;
    }

    return s0;
  }

  function peg$parsewhitespace() {
    var s0;

    if (peg$c3.test(input.charAt(peg$currPos))) {
      s0 = input.charAt(peg$currPos);
      peg$currPos++;
    } else {
      s0 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c4); }
    }

    return s0;
  }

  function peg$parsecomment() {
    var s0, s1, s2, s3;

    s0 = peg$currPos;
    if (input.charCodeAt(peg$currPos) === 40) {
      s1 = peg$c5;
      peg$currPos++;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c6); }
    }
    if (s1 !== peg$FAILED) {
      s2 = [];
      if (peg$c7.test(input.charAt(peg$currPos))) {
        s3 = input.charAt(peg$currPos);
        peg$currPos++;
      } else {
        s3 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c8); }
      }
      while (s3 !== peg$FAILED) {
        s2.push(s3);
        if (peg$c7.test(input.charAt(peg$currPos))) {
          s3 = input.charAt(peg$currPos);
          peg$currPos++;
        } else {
          s3 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c8); }
        }
      }
      if (s2 !== peg$FAILED) {
        if (input.charCodeAt(peg$currPos) === 41) {
          s3 = peg$c9;
          peg$currPos++;
        } else {
          s3 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c10); }
        }
        if (s3 !== peg$FAILED) {
          s1 = [s1, s2, s3];
          s0 = s1;
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parse_() {
    var s0, s1;

    s0 = [];
    s1 = peg$parsewhitespace();
    if (s1 === peg$FAILED) {
      s1 = peg$parsecomment();
    }
    if (s1 !== peg$FAILED) {
      while (s1 !== peg$FAILED) {
        s0.push(s1);
        s1 = peg$parsewhitespace();
        if (s1 === peg$FAILED) {
          s1 = peg$parsecomment();
        }
      }
    } else {
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parsenoise() {
    var s0;

    s0 = peg$parse_();
    if (s0 === peg$FAILED) {
      if (peg$c11.test(input.charAt(peg$currPos))) {
        s0 = input.charAt(peg$currPos);
        peg$currPos++;
      } else {
        s0 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c12); }
      }
    }

    return s0;
  }

  function peg$parseEOL() {
    var s0, s1, s2;

    s0 = peg$currPos;
    s1 = [];
    s2 = peg$parsenoise();
    while (s2 !== peg$FAILED) {
      s1.push(s2);
      s2 = peg$parsenoise();
    }
    if (s1 !== peg$FAILED) {
      if (input.charCodeAt(peg$currPos) === 10) {
        s2 = peg$c13;
        peg$currPos++;
      } else {
        s2 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c14); }
      }
      if (s2 !== peg$FAILED) {
        s1 = [s1, s2];
        s0 = s1;
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parseignore_rest_of_line() {
    var s0, s1, s2, s3;

    s0 = peg$currPos;
    s1 = peg$parse_();
    if (s1 !== peg$FAILED) {
      s2 = [];
      if (peg$c15.test(input.charAt(peg$currPos))) {
        s3 = input.charAt(peg$currPos);
        peg$currPos++;
      } else {
        s3 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c16); }
      }
      while (s3 !== peg$FAILED) {
        s2.push(s3);
        if (peg$c15.test(input.charAt(peg$currPos))) {
          s3 = input.charAt(peg$currPos);
          peg$currPos++;
        } else {
          s3 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c16); }
        }
      }
      if (s2 !== peg$FAILED) {
        s1 = [s1, s2];
        s0 = s1;
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }
    if (s0 === peg$FAILED) {
      s0 = null;
    }

    return s0;
  }

  function peg$parsestatement() {
    var s0;

    s0 = peg$parsebreak();
    if (s0 === peg$FAILED) {
      s0 = peg$parsecontinue();
      if (s0 === peg$FAILED) {
        s0 = peg$parsefunction();
        if (s0 === peg$FAILED) {
          s0 = peg$parsefunction_call();
          if (s0 === peg$FAILED) {
            s0 = peg$parsefunction_return();
            if (s0 === peg$FAILED) {
              s0 = peg$parseloop();
              if (s0 === peg$FAILED) {
                s0 = peg$parseconditional();
                if (s0 === peg$FAILED) {
                  s0 = peg$parseoperation();
                  if (s0 === peg$FAILED) {
                    s0 = peg$parsenor();
                  }
                }
              }
            }
          }
        }
      }
    }

    return s0;
  }

  function peg$parsebreak() {
    var s0, s1, s2;

    s0 = peg$currPos;
    if (input.substr(peg$currPos, 5).toLowerCase() === peg$c17) {
      s1 = input.substr(peg$currPos, 5);
      peg$currPos += 5;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c18); }
    }
    if (s1 !== peg$FAILED) {
      s2 = peg$parseignore_rest_of_line();
      if (s2 !== peg$FAILED) {
        peg$savedPos = s0;
        s1 = peg$c19();
        s0 = s1;
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parsecontinue() {
    var s0, s1, s2, s3;

    s0 = peg$currPos;
    s1 = peg$currPos;
    if (input.substr(peg$currPos, 8).toLowerCase() === peg$c20) {
      s2 = input.substr(peg$currPos, 8);
      peg$currPos += 8;
    } else {
      s2 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c21); }
    }
    if (s2 !== peg$FAILED) {
      s3 = peg$parseignore_rest_of_line();
      if (s3 !== peg$FAILED) {
        s2 = [s2, s3];
        s1 = s2;
      } else {
        peg$currPos = s1;
        s1 = peg$FAILED;
      }
    } else {
      peg$currPos = s1;
      s1 = peg$FAILED;
    }
    if (s1 === peg$FAILED) {
      if (input.substr(peg$currPos, 18).toLowerCase() === peg$c22) {
        s1 = input.substr(peg$currPos, 18);
        peg$currPos += 18;
      } else {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c23); }
      }
    }
    if (s1 !== peg$FAILED) {
      peg$savedPos = s0;
      s1 = peg$c24();
    }
    s0 = s1;

    return s0;
  }

  function peg$parsefunction() {
    var s0, s1, s2, s3, s4, s5, s6, s7;

    s0 = peg$currPos;
    s1 = peg$parsevariable();
    if (s1 !== peg$FAILED) {
      s2 = peg$parse_();
      if (s2 !== peg$FAILED) {
        if (input.substr(peg$currPos, 5).toLowerCase() === peg$c25) {
          s3 = input.substr(peg$currPos, 5);
          peg$currPos += 5;
        } else {
          s3 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c26); }
        }
        if (s3 !== peg$FAILED) {
          s4 = peg$parse_();
          if (s4 !== peg$FAILED) {
            s5 = peg$parsefunction_def_arg_list();
            if (s5 !== peg$FAILED) {
              s6 = peg$parseEOL();
              if (s6 !== peg$FAILED) {
                s7 = peg$parseblock();
                if (s7 !== peg$FAILED) {
                  peg$savedPos = s0;
                  s1 = peg$c27(s1, s5, s7);
                  s0 = s1;
                } else {
                  peg$currPos = s0;
                  s0 = peg$FAILED;
                }
              } else {
                peg$currPos = s0;
                s0 = peg$FAILED;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parsefunction_def_arg_separator() {
    var s0, s1, s2, s3;

    s0 = peg$currPos;
    s1 = peg$parse_();
    if (s1 === peg$FAILED) {
      s1 = null;
    }
    if (s1 !== peg$FAILED) {
      if (input.substr(peg$currPos, 5) === peg$c28) {
        s2 = peg$c28;
        peg$currPos += 5;
      } else {
        s2 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c29); }
      }
      if (s2 !== peg$FAILED) {
        s3 = peg$parse_();
        if (s3 !== peg$FAILED) {
          s1 = [s1, s2, s3];
          s0 = s1;
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }
    if (s0 === peg$FAILED) {
      s0 = peg$currPos;
      s1 = peg$parse_();
      if (s1 === peg$FAILED) {
        s1 = null;
      }
      if (s1 !== peg$FAILED) {
        if (input.substr(peg$currPos, 3) === peg$c30) {
          s2 = peg$c30;
          peg$currPos += 3;
        } else {
          s2 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c31); }
        }
        if (s2 === peg$FAILED) {
          if (input.charCodeAt(peg$currPos) === 38) {
            s2 = peg$c32;
            peg$currPos++;
          } else {
            s2 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$c33); }
          }
          if (s2 === peg$FAILED) {
            if (input.charCodeAt(peg$currPos) === 44) {
              s2 = peg$c34;
              peg$currPos++;
            } else {
              s2 = peg$FAILED;
              if (peg$silentFails === 0) { peg$fail(peg$c35); }
            }
            if (s2 === peg$FAILED) {
              if (input.substr(peg$currPos, 3) === peg$c36) {
                s2 = peg$c36;
                peg$currPos += 3;
              } else {
                s2 = peg$FAILED;
                if (peg$silentFails === 0) { peg$fail(peg$c37); }
              }
            }
          }
        }
        if (s2 !== peg$FAILED) {
          s3 = peg$parse_();
          if (s3 === peg$FAILED) {
            s3 = null;
          }
          if (s3 !== peg$FAILED) {
            s1 = [s1, s2, s3];
            s0 = s1;
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    }

    return s0;
  }

  function peg$parsefunction_def_arg_list() {
    var s0, s1, s2, s3;

    s0 = peg$currPos;
    s1 = peg$parsevariable();
    if (s1 !== peg$FAILED) {
      s2 = peg$parsefunction_def_arg_separator();
      if (s2 !== peg$FAILED) {
        s3 = peg$parsearg_list();
        if (s3 !== peg$FAILED) {
          peg$savedPos = s0;
          s1 = peg$c38(s1, s3);
          s0 = s1;
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }
    if (s0 === peg$FAILED) {
      s0 = peg$currPos;
      s1 = peg$parsevariable();
      if (s1 !== peg$FAILED) {
        peg$savedPos = s0;
        s1 = peg$c39(s1);
      }
      s0 = s1;
    }

    return s0;
  }

  function peg$parsearg_separator() {
    var s0, s1, s2, s3;

    s0 = peg$currPos;
    s1 = peg$parse_();
    if (s1 === peg$FAILED) {
      s1 = null;
    }
    if (s1 !== peg$FAILED) {
      if (input.substr(peg$currPos, 5) === peg$c28) {
        s2 = peg$c28;
        peg$currPos += 5;
      } else {
        s2 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c29); }
      }
      if (s2 !== peg$FAILED) {
        s3 = peg$parse_();
        if (s3 !== peg$FAILED) {
          s1 = [s1, s2, s3];
          s0 = s1;
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }
    if (s0 === peg$FAILED) {
      s0 = peg$currPos;
      s1 = peg$parse_();
      if (s1 === peg$FAILED) {
        s1 = null;
      }
      if (s1 !== peg$FAILED) {
        if (input.charCodeAt(peg$currPos) === 38) {
          s2 = peg$c32;
          peg$currPos++;
        } else {
          s2 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c33); }
        }
        if (s2 === peg$FAILED) {
          if (input.charCodeAt(peg$currPos) === 44) {
            s2 = peg$c34;
            peg$currPos++;
          } else {
            s2 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$c35); }
          }
          if (s2 === peg$FAILED) {
            if (input.substr(peg$currPos, 3) === peg$c36) {
              s2 = peg$c36;
              peg$currPos += 3;
            } else {
              s2 = peg$FAILED;
              if (peg$silentFails === 0) { peg$fail(peg$c37); }
            }
          }
        }
        if (s2 !== peg$FAILED) {
          s3 = peg$parse_();
          if (s3 === peg$FAILED) {
            s3 = null;
          }
          if (s3 !== peg$FAILED) {
            s1 = [s1, s2, s3];
            s0 = s1;
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    }

    return s0;
  }

  function peg$parsearg_list() {
    var s0, s1, s2, s3;

    s0 = peg$currPos;
    s1 = peg$parsevariable();
    if (s1 !== peg$FAILED) {
      s2 = peg$parsearg_separator();
      if (s2 !== peg$FAILED) {
        s3 = peg$parsearg_list();
        if (s3 !== peg$FAILED) {
          peg$savedPos = s0;
          s1 = peg$c38(s1, s3);
          s0 = s1;
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }
    if (s0 === peg$FAILED) {
      s0 = peg$currPos;
      s1 = peg$parsevariable();
      if (s1 !== peg$FAILED) {
        peg$savedPos = s0;
        s1 = peg$c39(s1);
      }
      s0 = s1;
    }

    return s0;
  }

  function peg$parsefunction_call() {
    var s0, s1, s2, s3, s4, s5;

    s0 = peg$currPos;
    s1 = peg$parsevariable();
    if (s1 !== peg$FAILED) {
      s2 = peg$parse_();
      if (s2 !== peg$FAILED) {
        if (input.substr(peg$currPos, 6).toLowerCase() === peg$c40) {
          s3 = input.substr(peg$currPos, 6);
          peg$currPos += 6;
        } else {
          s3 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c41); }
        }
        if (s3 !== peg$FAILED) {
          s4 = peg$parse_();
          if (s4 !== peg$FAILED) {
            s5 = peg$parsecall_args();
            if (s5 !== peg$FAILED) {
              peg$savedPos = s0;
              s1 = peg$c42(s1, s5);
              s0 = s1;
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parsecall_args() {
    var s0, s1, s2, s3;

    s0 = peg$currPos;
    s1 = peg$parsesimple_expression();
    if (s1 !== peg$FAILED) {
      s2 = peg$parsearg_separator();
      if (s2 !== peg$FAILED) {
        s3 = peg$parsecall_args();
        if (s3 !== peg$FAILED) {
          peg$savedPos = s0;
          s1 = peg$c38(s1, s3);
          s0 = s1;
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }
    if (s0 === peg$FAILED) {
      s0 = peg$currPos;
      s1 = peg$parsesimple_expression();
      if (s1 !== peg$FAILED) {
        peg$savedPos = s0;
        s1 = peg$c39(s1);
      }
      s0 = s1;
    }

    return s0;
  }

  function peg$parsereturn() {
    var s0;

    if (input.substr(peg$currPos, 6).toLowerCase() === peg$c43) {
      s0 = input.substr(peg$currPos, 6);
      peg$currPos += 6;
    } else {
      s0 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c44); }
    }
    if (s0 === peg$FAILED) {
      if (input.substr(peg$currPos, 9).toLowerCase() === peg$c45) {
        s0 = input.substr(peg$currPos, 9);
        peg$currPos += 9;
      } else {
        s0 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c46); }
      }
    }

    return s0;
  }

  function peg$parsefunction_return() {
    var s0, s1, s2, s3;

    s0 = peg$currPos;
    s1 = peg$parsereturn();
    if (s1 !== peg$FAILED) {
      s2 = peg$parse_();
      if (s2 !== peg$FAILED) {
        s3 = peg$parsenor();
        if (s3 !== peg$FAILED) {
          peg$savedPos = s0;
          s1 = peg$c47(s3);
          s0 = s1;
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parseoperation() {
    var s0;

    s0 = peg$parsereadline();
    if (s0 === peg$FAILED) {
      s0 = peg$parseoutput();
      if (s0 === peg$FAILED) {
        s0 = peg$parsecrement();
        if (s0 === peg$FAILED) {
          s0 = peg$parseassignment();
        }
      }
    }

    return s0;
  }

  function peg$parsereadline() {
    var s0, s1, s2, s3;

    s0 = peg$currPos;
    if (input.substr(peg$currPos, 9).toLowerCase() === peg$c48) {
      s1 = input.substr(peg$currPos, 9);
      peg$currPos += 9;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c49); }
    }
    if (s1 !== peg$FAILED) {
      s2 = peg$parse_();
      if (s2 !== peg$FAILED) {
        s3 = peg$parsevariable();
        if (s3 !== peg$FAILED) {
          peg$savedPos = s0;
          s1 = peg$c50(s3);
          s0 = s1;
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }
    if (s0 === peg$FAILED) {
      s0 = peg$currPos;
      if (input.substr(peg$currPos, 6).toLowerCase() === peg$c51) {
        s1 = input.substr(peg$currPos, 6);
        peg$currPos += 6;
      } else {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c52); }
      }
      if (s1 !== peg$FAILED) {
        peg$savedPos = s0;
        s1 = peg$c53();
      }
      s0 = s1;
    }

    return s0;
  }

  function peg$parsecontinuation() {
    var s0, s1, s2, s3;

    s0 = peg$currPos;
    s1 = peg$parseEOL();
    if (s1 !== peg$FAILED) {
      s2 = [];
      s3 = peg$parse_();
      while (s3 !== peg$FAILED) {
        s2.push(s3);
        s3 = peg$parse_();
      }
      if (s2 !== peg$FAILED) {
        s3 = peg$parsestatement();
        if (s3 !== peg$FAILED) {
          peg$savedPos = s0;
          s1 = peg$c1(s3);
          s0 = s1;
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parseblock() {
    var s0, s1, s2, s3;

    s0 = peg$currPos;
    s1 = peg$parsestatement();
    if (s1 !== peg$FAILED) {
      s2 = [];
      s3 = peg$parsecontinuation();
      if (s3 !== peg$FAILED) {
        while (s3 !== peg$FAILED) {
          s2.push(s3);
          s3 = peg$parsecontinuation();
        }
      } else {
        s2 = peg$FAILED;
      }
      if (s2 !== peg$FAILED) {
        peg$savedPos = s0;
        s1 = peg$c54(s1, s2);
        s0 = s1;
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }
    if (s0 === peg$FAILED) {
      s0 = peg$currPos;
      s1 = peg$parsestatement();
      if (s1 !== peg$FAILED) {
        peg$savedPos = s0;
        s1 = peg$c1(s1);
      }
      s0 = s1;
    }

    return s0;
  }

  function peg$parseconsequent() {
    var s0, s1, s2;

    s0 = peg$currPos;
    s1 = peg$parse_();
    if (s1 !== peg$FAILED) {
      s2 = peg$parsestatement();
      if (s2 !== peg$FAILED) {
        peg$savedPos = s0;
        s1 = peg$c1(s2);
        s0 = s1;
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }
    if (s0 === peg$FAILED) {
      s0 = peg$currPos;
      s1 = peg$parseEOL();
      if (s1 !== peg$FAILED) {
        s2 = peg$parseblock();
        if (s2 !== peg$FAILED) {
          peg$savedPos = s0;
          s1 = peg$c1(s2);
          s0 = s1;
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    }

    return s0;
  }

  function peg$parsealternate() {
    var s0, s1, s2, s3, s4;

    s0 = peg$currPos;
    s1 = peg$parse_();
    if (s1 !== peg$FAILED) {
      if (input.substr(peg$currPos, 4).toLowerCase() === peg$c55) {
        s2 = input.substr(peg$currPos, 4);
        peg$currPos += 4;
      } else {
        s2 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c56); }
      }
      if (s2 !== peg$FAILED) {
        s3 = peg$parse_();
        if (s3 !== peg$FAILED) {
          s4 = peg$parsestatement();
          if (s4 !== peg$FAILED) {
            peg$savedPos = s0;
            s1 = peg$c57(s4);
            s0 = s1;
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }
    if (s0 === peg$FAILED) {
      s0 = peg$currPos;
      s1 = [];
      s2 = peg$parseEOL();
      if (s2 !== peg$FAILED) {
        while (s2 !== peg$FAILED) {
          s1.push(s2);
          s2 = peg$parseEOL();
        }
      } else {
        s1 = peg$FAILED;
      }
      if (s1 !== peg$FAILED) {
        if (input.substr(peg$currPos, 4).toLowerCase() === peg$c55) {
          s2 = input.substr(peg$currPos, 4);
          peg$currPos += 4;
        } else {
          s2 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c56); }
        }
        if (s2 !== peg$FAILED) {
          s3 = peg$parse_();
          if (s3 !== peg$FAILED) {
            s4 = peg$parsestatement();
            if (s4 !== peg$FAILED) {
              peg$savedPos = s0;
              s1 = peg$c57(s4);
              s0 = s1;
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
      if (s0 === peg$FAILED) {
        s0 = peg$currPos;
        s1 = [];
        s2 = peg$parseEOL();
        if (s2 !== peg$FAILED) {
          while (s2 !== peg$FAILED) {
            s1.push(s2);
            s2 = peg$parseEOL();
          }
        } else {
          s1 = peg$FAILED;
        }
        if (s1 !== peg$FAILED) {
          if (input.substr(peg$currPos, 4).toLowerCase() === peg$c55) {
            s2 = input.substr(peg$currPos, 4);
            peg$currPos += 4;
          } else {
            s2 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$c56); }
          }
          if (s2 !== peg$FAILED) {
            s3 = peg$parseEOL();
            if (s3 !== peg$FAILED) {
              s4 = peg$parseblock();
              if (s4 !== peg$FAILED) {
                peg$savedPos = s0;
                s1 = peg$c57(s4);
                s0 = s1;
              } else {
                peg$currPos = s0;
                s0 = peg$FAILED;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
        if (s0 === peg$FAILED) {
          s0 = peg$currPos;
          s1 = peg$parseEOL();
          if (s1 !== peg$FAILED) {
            peg$savedPos = s0;
            s1 = peg$c2();
          }
          s0 = s1;
        }
      }
    }

    return s0;
  }

  function peg$parseconditional() {
    var s0, s1, s2, s3, s4, s5;

    s0 = peg$currPos;
    if (input.substr(peg$currPos, 2).toLowerCase() === peg$c58) {
      s1 = input.substr(peg$currPos, 2);
      peg$currPos += 2;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c59); }
    }
    if (s1 !== peg$FAILED) {
      s2 = peg$parse_();
      if (s2 !== peg$FAILED) {
        s3 = peg$parsenor();
        if (s3 !== peg$FAILED) {
          s4 = peg$parseconsequent();
          if (s4 === peg$FAILED) {
            s4 = null;
          }
          if (s4 !== peg$FAILED) {
            s5 = peg$parsealternate();
            if (s5 === peg$FAILED) {
              s5 = null;
            }
            if (s5 !== peg$FAILED) {
              peg$savedPos = s0;
              s1 = peg$c60(s3, s4, s5);
              s0 = s1;
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parseloopable() {
    var s0, s1, s2, s3;

    s0 = peg$currPos;
    s1 = peg$parse_();
    if (s1 !== peg$FAILED) {
      s2 = peg$parsestatement();
      if (s2 !== peg$FAILED) {
        peg$savedPos = s0;
        s1 = peg$c1(s2);
        s0 = s1;
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }
    if (s0 === peg$FAILED) {
      s0 = peg$currPos;
      s1 = peg$parseEOL();
      if (s1 !== peg$FAILED) {
        s2 = peg$parseblock();
        if (s2 !== peg$FAILED) {
          s3 = peg$parseEOL();
          if (s3 !== peg$FAILED) {
            peg$savedPos = s0;
            s1 = peg$c1(s2);
            s0 = s1;
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    }

    return s0;
  }

  function peg$parseloop() {
    var s0, s1, s2, s3, s4;

    s0 = peg$currPos;
    if (input.substr(peg$currPos, 5).toLowerCase() === peg$c61) {
      s1 = input.substr(peg$currPos, 5);
      peg$currPos += 5;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c62); }
    }
    if (s1 !== peg$FAILED) {
      s2 = peg$parse_();
      if (s2 !== peg$FAILED) {
        s3 = peg$parsenor();
        if (s3 !== peg$FAILED) {
          s4 = peg$parseloopable();
          if (s4 !== peg$FAILED) {
            peg$savedPos = s0;
            s1 = peg$c63(s3, s4);
            s0 = s1;
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }
    if (s0 === peg$FAILED) {
      s0 = peg$currPos;
      if (input.substr(peg$currPos, 5).toLowerCase() === peg$c64) {
        s1 = input.substr(peg$currPos, 5);
        peg$currPos += 5;
      } else {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c65); }
      }
      if (s1 !== peg$FAILED) {
        s2 = peg$parse_();
        if (s2 !== peg$FAILED) {
          s3 = peg$parsenor();
          if (s3 !== peg$FAILED) {
            s4 = peg$parseloopable();
            if (s4 !== peg$FAILED) {
              peg$savedPos = s0;
              s1 = peg$c66(s3, s4);
              s0 = s1;
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    }

    return s0;
  }

  function peg$parseoutput() {
    var s0, s1, s2, s3;

    s0 = peg$currPos;
    if (input.substr(peg$currPos, 3).toLowerCase() === peg$c67) {
      s1 = input.substr(peg$currPos, 3);
      peg$currPos += 3;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c68); }
    }
    if (s1 === peg$FAILED) {
      if (input.substr(peg$currPos, 5).toLowerCase() === peg$c69) {
        s1 = input.substr(peg$currPos, 5);
        peg$currPos += 5;
      } else {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c70); }
      }
      if (s1 === peg$FAILED) {
        if (input.substr(peg$currPos, 7).toLowerCase() === peg$c71) {
          s1 = input.substr(peg$currPos, 7);
          peg$currPos += 7;
        } else {
          s1 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c72); }
        }
        if (s1 === peg$FAILED) {
          if (input.substr(peg$currPos, 6).toLowerCase() === peg$c73) {
            s1 = input.substr(peg$currPos, 6);
            peg$currPos += 6;
          } else {
            s1 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$c74); }
          }
        }
      }
    }
    if (s1 !== peg$FAILED) {
      s2 = peg$parse_();
      if (s2 !== peg$FAILED) {
        s3 = peg$parsenor();
        if (s3 !== peg$FAILED) {
          peg$savedPos = s0;
          s1 = peg$c75(s3);
          s0 = s1;
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parsesimple_expression() {
    var s0;

    s0 = peg$parsefunction_call();
    if (s0 === peg$FAILED) {
      s0 = peg$parseconstant();
      if (s0 === peg$FAILED) {
        s0 = peg$parselookup();
        if (s0 === peg$FAILED) {
          s0 = peg$parseliteral();
          if (s0 === peg$FAILED) {
            s0 = peg$parsepronoun();
          }
        }
      }
    }

    return s0;
  }

  function peg$parseliteral() {
    var s0;

    s0 = peg$parseconstant();
    if (s0 === peg$FAILED) {
      s0 = peg$parsenumber();
      if (s0 === peg$FAILED) {
        s0 = peg$parsestring();
      }
    }

    return s0;
  }

  function peg$parseconstant() {
    var s0;

    s0 = peg$parsenull();
    if (s0 === peg$FAILED) {
      s0 = peg$parsetrue();
      if (s0 === peg$FAILED) {
        s0 = peg$parsefalse();
        if (s0 === peg$FAILED) {
          s0 = peg$parsemysterious();
        }
      }
    }

    return s0;
  }

  function peg$parsetrue() {
    var s0, s1;

    s0 = peg$currPos;
    if (input.substr(peg$currPos, 4).toLowerCase() === peg$c76) {
      s1 = input.substr(peg$currPos, 4);
      peg$currPos += 4;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c77); }
    }
    if (s1 === peg$FAILED) {
      if (input.substr(peg$currPos, 2).toLowerCase() === peg$c78) {
        s1 = input.substr(peg$currPos, 2);
        peg$currPos += 2;
      } else {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c79); }
      }
      if (s1 === peg$FAILED) {
        if (input.substr(peg$currPos, 5).toLowerCase() === peg$c80) {
          s1 = input.substr(peg$currPos, 5);
          peg$currPos += 5;
        } else {
          s1 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c81); }
        }
        if (s1 === peg$FAILED) {
          if (input.substr(peg$currPos, 3).toLowerCase() === peg$c82) {
            s1 = input.substr(peg$currPos, 3);
            peg$currPos += 3;
          } else {
            s1 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$c83); }
          }
        }
      }
    }
    if (s1 !== peg$FAILED) {
      peg$savedPos = s0;
      s1 = peg$c84();
    }
    s0 = s1;

    return s0;
  }

  function peg$parsefalse() {
    var s0, s1;

    s0 = peg$currPos;
    if (input.substr(peg$currPos, 5).toLowerCase() === peg$c85) {
      s1 = input.substr(peg$currPos, 5);
      peg$currPos += 5;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c86); }
    }
    if (s1 === peg$FAILED) {
      if (input.substr(peg$currPos, 4).toLowerCase() === peg$c87) {
        s1 = input.substr(peg$currPos, 4);
        peg$currPos += 4;
      } else {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c88); }
      }
      if (s1 === peg$FAILED) {
        if (input.substr(peg$currPos, 5).toLowerCase() === peg$c89) {
          s1 = input.substr(peg$currPos, 5);
          peg$currPos += 5;
        } else {
          s1 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c90); }
        }
        if (s1 === peg$FAILED) {
          if (input.substr(peg$currPos, 2).toLowerCase() === peg$c91) {
            s1 = input.substr(peg$currPos, 2);
            peg$currPos += 2;
          } else {
            s1 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$c92); }
          }
        }
      }
    }
    if (s1 !== peg$FAILED) {
      peg$savedPos = s0;
      s1 = peg$c93();
    }
    s0 = s1;

    return s0;
  }

  function peg$parsenull() {
    var s0, s1;

    s0 = peg$currPos;
    if (input.substr(peg$currPos, 4).toLowerCase() === peg$c94) {
      s1 = input.substr(peg$currPos, 4);
      peg$currPos += 4;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c95); }
    }
    if (s1 === peg$FAILED) {
      if (input.substr(peg$currPos, 7).toLowerCase() === peg$c96) {
        s1 = input.substr(peg$currPos, 7);
        peg$currPos += 7;
      } else {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c97); }
      }
      if (s1 === peg$FAILED) {
        if (input.substr(peg$currPos, 7).toLowerCase() === peg$c98) {
          s1 = input.substr(peg$currPos, 7);
          peg$currPos += 7;
        } else {
          s1 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c99); }
        }
        if (s1 === peg$FAILED) {
          if (input.substr(peg$currPos, 6).toLowerCase() === peg$c100) {
            s1 = input.substr(peg$currPos, 6);
            peg$currPos += 6;
          } else {
            s1 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$c101); }
          }
          if (s1 === peg$FAILED) {
            if (input.substr(peg$currPos, 5).toLowerCase() === peg$c102) {
              s1 = input.substr(peg$currPos, 5);
              peg$currPos += 5;
            } else {
              s1 = peg$FAILED;
              if (peg$silentFails === 0) { peg$fail(peg$c103); }
            }
            if (s1 === peg$FAILED) {
              if (input.substr(peg$currPos, 4).toLowerCase() === peg$c104) {
                s1 = input.substr(peg$currPos, 4);
                peg$currPos += 4;
              } else {
                s1 = peg$FAILED;
                if (peg$silentFails === 0) { peg$fail(peg$c105); }
              }
            }
          }
        }
      }
    }
    if (s1 !== peg$FAILED) {
      peg$savedPos = s0;
      s1 = peg$c106();
    }
    s0 = s1;

    return s0;
  }

  function peg$parsemysterious() {
    var s0, s1;

    s0 = peg$currPos;
    if (input.substr(peg$currPos, 10) === peg$c107) {
      s1 = peg$c107;
      peg$currPos += 10;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c108); }
    }
    if (s1 !== peg$FAILED) {
      peg$savedPos = s0;
      s1 = peg$c109();
    }
    s0 = s1;

    return s0;
  }

  function peg$parsenumber() {
    var s0, s1, s2, s3, s4, s5, s6, s7, s8;

    s0 = peg$currPos;
    s1 = peg$currPos;
    s2 = peg$currPos;
    if (input.charCodeAt(peg$currPos) === 45) {
      s3 = peg$c110;
      peg$currPos++;
    } else {
      s3 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c111); }
    }
    if (s3 === peg$FAILED) {
      s3 = null;
    }
    if (s3 !== peg$FAILED) {
      s4 = [];
      if (peg$c112.test(input.charAt(peg$currPos))) {
        s5 = input.charAt(peg$currPos);
        peg$currPos++;
      } else {
        s5 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c113); }
      }
      if (s5 !== peg$FAILED) {
        while (s5 !== peg$FAILED) {
          s4.push(s5);
          if (peg$c112.test(input.charAt(peg$currPos))) {
            s5 = input.charAt(peg$currPos);
            peg$currPos++;
          } else {
            s5 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$c113); }
          }
        }
      } else {
        s4 = peg$FAILED;
      }
      if (s4 !== peg$FAILED) {
        s5 = peg$currPos;
        if (input.charCodeAt(peg$currPos) === 46) {
          s6 = peg$c114;
          peg$currPos++;
        } else {
          s6 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c115); }
        }
        if (s6 !== peg$FAILED) {
          s7 = [];
          if (peg$c112.test(input.charAt(peg$currPos))) {
            s8 = input.charAt(peg$currPos);
            peg$currPos++;
          } else {
            s8 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$c113); }
          }
          if (s8 !== peg$FAILED) {
            while (s8 !== peg$FAILED) {
              s7.push(s8);
              if (peg$c112.test(input.charAt(peg$currPos))) {
                s8 = input.charAt(peg$currPos);
                peg$currPos++;
              } else {
                s8 = peg$FAILED;
                if (peg$silentFails === 0) { peg$fail(peg$c113); }
              }
            }
          } else {
            s7 = peg$FAILED;
          }
          if (s7 !== peg$FAILED) {
            s6 = [s6, s7];
            s5 = s6;
          } else {
            peg$currPos = s5;
            s5 = peg$FAILED;
          }
        } else {
          peg$currPos = s5;
          s5 = peg$FAILED;
        }
        if (s5 === peg$FAILED) {
          s5 = null;
        }
        if (s5 !== peg$FAILED) {
          s3 = [s3, s4, s5];
          s2 = s3;
        } else {
          peg$currPos = s2;
          s2 = peg$FAILED;
        }
      } else {
        peg$currPos = s2;
        s2 = peg$FAILED;
      }
    } else {
      peg$currPos = s2;
      s2 = peg$FAILED;
    }
    if (s2 !== peg$FAILED) {
      s1 = input.substring(s1, peg$currPos);
    } else {
      s1 = s2;
    }
    if (s1 !== peg$FAILED) {
      if (input.charCodeAt(peg$currPos) === 46) {
        s2 = peg$c114;
        peg$currPos++;
      } else {
        s2 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c115); }
      }
      if (s2 === peg$FAILED) {
        s2 = null;
      }
      if (s2 !== peg$FAILED) {
        peg$savedPos = s0;
        s1 = peg$c116(s1);
        s0 = s1;
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }
    if (s0 === peg$FAILED) {
      s0 = peg$currPos;
      s1 = peg$currPos;
      s2 = peg$currPos;
      if (input.charCodeAt(peg$currPos) === 46) {
        s3 = peg$c114;
        peg$currPos++;
      } else {
        s3 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c115); }
      }
      if (s3 !== peg$FAILED) {
        s4 = [];
        if (peg$c112.test(input.charAt(peg$currPos))) {
          s5 = input.charAt(peg$currPos);
          peg$currPos++;
        } else {
          s5 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c113); }
        }
        if (s5 !== peg$FAILED) {
          while (s5 !== peg$FAILED) {
            s4.push(s5);
            if (peg$c112.test(input.charAt(peg$currPos))) {
              s5 = input.charAt(peg$currPos);
              peg$currPos++;
            } else {
              s5 = peg$FAILED;
              if (peg$silentFails === 0) { peg$fail(peg$c113); }
            }
          }
        } else {
          s4 = peg$FAILED;
        }
        if (s4 !== peg$FAILED) {
          s3 = [s3, s4];
          s2 = s3;
        } else {
          peg$currPos = s2;
          s2 = peg$FAILED;
        }
      } else {
        peg$currPos = s2;
        s2 = peg$FAILED;
      }
      if (s2 !== peg$FAILED) {
        s1 = input.substring(s1, peg$currPos);
      } else {
        s1 = s2;
      }
      if (s1 !== peg$FAILED) {
        peg$savedPos = s0;
        s1 = peg$c117(s1);
      }
      s0 = s1;
    }

    return s0;
  }

  function peg$parsestring() {
    var s0, s1, s2, s3, s4;

    s0 = peg$currPos;
    if (input.charCodeAt(peg$currPos) === 34) {
      s1 = peg$c118;
      peg$currPos++;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c119); }
    }
    if (s1 !== peg$FAILED) {
      s2 = peg$currPos;
      s3 = [];
      if (peg$c120.test(input.charAt(peg$currPos))) {
        s4 = input.charAt(peg$currPos);
        peg$currPos++;
      } else {
        s4 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c121); }
      }
      while (s4 !== peg$FAILED) {
        s3.push(s4);
        if (peg$c120.test(input.charAt(peg$currPos))) {
          s4 = input.charAt(peg$currPos);
          peg$currPos++;
        } else {
          s4 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c121); }
        }
      }
      if (s3 !== peg$FAILED) {
        s2 = input.substring(s2, peg$currPos);
      } else {
        s2 = s3;
      }
      if (s2 !== peg$FAILED) {
        if (input.charCodeAt(peg$currPos) === 34) {
          s3 = peg$c118;
          peg$currPos++;
        } else {
          s3 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c119); }
        }
        if (s3 !== peg$FAILED) {
          peg$savedPos = s0;
          s1 = peg$c122(s2);
          s0 = s1;
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parsenor() {
    var s0, s1, s2, s3, s4, s5;

    s0 = peg$currPos;
    s1 = peg$parseor();
    if (s1 !== peg$FAILED) {
      s2 = peg$parse_();
      if (s2 !== peg$FAILED) {
        if (input.substr(peg$currPos, 3) === peg$c123) {
          s3 = peg$c123;
          peg$currPos += 3;
        } else {
          s3 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c124); }
        }
        if (s3 !== peg$FAILED) {
          s4 = peg$parse_();
          if (s4 !== peg$FAILED) {
            s5 = peg$parsenor();
            if (s5 !== peg$FAILED) {
              peg$savedPos = s0;
              s1 = peg$c125(s1, s5);
              s0 = s1;
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }
    if (s0 === peg$FAILED) {
      s0 = peg$parseor();
    }

    return s0;
  }

  function peg$parseor() {
    var s0, s1, s2, s3, s4, s5;

    s0 = peg$currPos;
    s1 = peg$parseand();
    if (s1 !== peg$FAILED) {
      s2 = peg$parse_();
      if (s2 !== peg$FAILED) {
        if (input.substr(peg$currPos, 2) === peg$c126) {
          s3 = peg$c126;
          peg$currPos += 2;
        } else {
          s3 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c127); }
        }
        if (s3 !== peg$FAILED) {
          s4 = peg$parse_();
          if (s4 !== peg$FAILED) {
            s5 = peg$parseor();
            if (s5 !== peg$FAILED) {
              peg$savedPos = s0;
              s1 = peg$c128(s1, s5);
              s0 = s1;
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }
    if (s0 === peg$FAILED) {
      s0 = peg$parseand();
    }

    return s0;
  }

  function peg$parseand() {
    var s0, s1, s2, s3, s4, s5;

    s0 = peg$currPos;
    s1 = peg$parseequality_check();
    if (s1 !== peg$FAILED) {
      s2 = peg$parse_();
      if (s2 !== peg$FAILED) {
        if (input.substr(peg$currPos, 3) === peg$c30) {
          s3 = peg$c30;
          peg$currPos += 3;
        } else {
          s3 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c31); }
        }
        if (s3 !== peg$FAILED) {
          s4 = peg$parse_();
          if (s4 !== peg$FAILED) {
            s5 = peg$parseand();
            if (s5 !== peg$FAILED) {
              peg$savedPos = s0;
              s1 = peg$c129(s1, s5);
              s0 = s1;
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }
    if (s0 === peg$FAILED) {
      s0 = peg$parseequality_check();
    }

    return s0;
  }

  function peg$parseeq() {
    var s0, s1;

    s0 = peg$currPos;
    if (input.substr(peg$currPos, 4).toLowerCase() === peg$c130) {
      s1 = input.substr(peg$currPos, 4);
      peg$currPos += 4;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c131); }
    }
    if (s1 === peg$FAILED) {
      if (input.substr(peg$currPos, 5).toLowerCase() === peg$c132) {
        s1 = input.substr(peg$currPos, 5);
        peg$currPos += 5;
      } else {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c133); }
      }
    }
    if (s1 !== peg$FAILED) {
      peg$savedPos = s0;
      s1 = peg$c134();
    }
    s0 = s1;
    if (s0 === peg$FAILED) {
      s0 = peg$currPos;
      if (input.substr(peg$currPos, 2).toLowerCase() === peg$c135) {
        s1 = input.substr(peg$currPos, 2);
        peg$currPos += 2;
      } else {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c136); }
      }
      if (s1 !== peg$FAILED) {
        peg$savedPos = s0;
        s1 = peg$c137();
      }
      s0 = s1;
    }

    return s0;
  }

  function peg$parseequality_check() {
    var s0, s1, s2, s3, s4, s5;

    s0 = peg$currPos;
    s1 = peg$parsenot();
    if (s1 !== peg$FAILED) {
      s2 = peg$parse_();
      if (s2 !== peg$FAILED) {
        s3 = peg$parseeq();
        if (s3 !== peg$FAILED) {
          s4 = peg$parse_();
          if (s4 !== peg$FAILED) {
            s5 = peg$parseequality_check();
            if (s5 !== peg$FAILED) {
              peg$savedPos = s0;
              s1 = peg$c138(s1, s3, s5);
              s0 = s1;
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }
    if (s0 === peg$FAILED) {
      s0 = peg$parsenot();
    }

    return s0;
  }

  function peg$parsenot() {
    var s0, s1, s2, s3;

    s0 = peg$currPos;
    if (input.substr(peg$currPos, 3) === peg$c139) {
      s1 = peg$c139;
      peg$currPos += 3;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c140); }
    }
    if (s1 !== peg$FAILED) {
      s2 = peg$parse_();
      if (s2 !== peg$FAILED) {
        s3 = peg$parsenot();
        if (s3 !== peg$FAILED) {
          peg$savedPos = s0;
          s1 = peg$c141(s3);
          s0 = s1;
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }
    if (s0 === peg$FAILED) {
      s0 = peg$parsecomparison();
    }

    return s0;
  }

  function peg$parsecomparison() {
    var s0, s1, s2, s3, s4, s5;

    s0 = peg$currPos;
    s1 = peg$parsearithmetic();
    if (s1 !== peg$FAILED) {
      s2 = peg$parse_();
      if (s2 !== peg$FAILED) {
        s3 = peg$parsecomparator();
        if (s3 !== peg$FAILED) {
          s4 = peg$parse_();
          if (s4 !== peg$FAILED) {
            s5 = peg$parsecomparison();
            if (s5 !== peg$FAILED) {
              peg$savedPos = s0;
              s1 = peg$c138(s1, s3, s5);
              s0 = s1;
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }
    if (s0 === peg$FAILED) {
      s0 = peg$parsearithmetic();
    }

    return s0;
  }

  function peg$parsegreater() {
    var s0;

    if (input.substr(peg$currPos, 6).toLowerCase() === peg$c142) {
      s0 = input.substr(peg$currPos, 6);
      peg$currPos += 6;
    } else {
      s0 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c143); }
    }
    if (s0 === peg$FAILED) {
      if (input.substr(peg$currPos, 7).toLowerCase() === peg$c144) {
        s0 = input.substr(peg$currPos, 7);
        peg$currPos += 7;
      } else {
        s0 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c145); }
      }
      if (s0 === peg$FAILED) {
        if (input.substr(peg$currPos, 6).toLowerCase() === peg$c146) {
          s0 = input.substr(peg$currPos, 6);
          peg$currPos += 6;
        } else {
          s0 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c147); }
        }
        if (s0 === peg$FAILED) {
          if (input.substr(peg$currPos, 8).toLowerCase() === peg$c148) {
            s0 = input.substr(peg$currPos, 8);
            peg$currPos += 8;
          } else {
            s0 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$c149); }
          }
        }
      }
    }

    return s0;
  }

  function peg$parsesmaller() {
    var s0;

    if (input.substr(peg$currPos, 5).toLowerCase() === peg$c150) {
      s0 = input.substr(peg$currPos, 5);
      peg$currPos += 5;
    } else {
      s0 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c151); }
    }
    if (s0 === peg$FAILED) {
      if (input.substr(peg$currPos, 4).toLowerCase() === peg$c152) {
        s0 = input.substr(peg$currPos, 4);
        peg$currPos += 4;
      } else {
        s0 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c153); }
      }
      if (s0 === peg$FAILED) {
        if (input.substr(peg$currPos, 7).toLowerCase() === peg$c154) {
          s0 = input.substr(peg$currPos, 7);
          peg$currPos += 7;
        } else {
          s0 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c155); }
        }
        if (s0 === peg$FAILED) {
          if (input.substr(peg$currPos, 6).toLowerCase() === peg$c156) {
            s0 = input.substr(peg$currPos, 6);
            peg$currPos += 6;
          } else {
            s0 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$c157); }
          }
        }
      }
    }

    return s0;
  }

  function peg$parsegreat() {
    var s0;

    if (input.substr(peg$currPos, 4).toLowerCase() === peg$c158) {
      s0 = input.substr(peg$currPos, 4);
      peg$currPos += 4;
    } else {
      s0 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c159); }
    }
    if (s0 === peg$FAILED) {
      if (input.substr(peg$currPos, 5).toLowerCase() === peg$c160) {
        s0 = input.substr(peg$currPos, 5);
        peg$currPos += 5;
      } else {
        s0 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c161); }
      }
      if (s0 === peg$FAILED) {
        if (input.substr(peg$currPos, 3).toLowerCase() === peg$c162) {
          s0 = input.substr(peg$currPos, 3);
          peg$currPos += 3;
        } else {
          s0 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c163); }
        }
        if (s0 === peg$FAILED) {
          if (input.substr(peg$currPos, 6).toLowerCase() === peg$c164) {
            s0 = input.substr(peg$currPos, 6);
            peg$currPos += 6;
          } else {
            s0 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$c165); }
          }
        }
      }
    }

    return s0;
  }

  function peg$parsesmall() {
    var s0;

    if (input.substr(peg$currPos, 3).toLowerCase() === peg$c166) {
      s0 = input.substr(peg$currPos, 3);
      peg$currPos += 3;
    } else {
      s0 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c167); }
    }
    if (s0 === peg$FAILED) {
      if (input.substr(peg$currPos, 5).toLowerCase() === peg$c168) {
        s0 = input.substr(peg$currPos, 5);
        peg$currPos += 5;
      } else {
        s0 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c169); }
      }
      if (s0 === peg$FAILED) {
        if (input.substr(peg$currPos, 4).toLowerCase() === peg$c170) {
          s0 = input.substr(peg$currPos, 4);
          peg$currPos += 4;
        } else {
          s0 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c171); }
        }
      }
    }

    return s0;
  }

  function peg$parsecomparator() {
    var s0, s1, s2, s3, s4, s5, s6, s7;

    s0 = peg$currPos;
    if (input.substr(peg$currPos, 2).toLowerCase() === peg$c135) {
      s1 = input.substr(peg$currPos, 2);
      peg$currPos += 2;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c136); }
    }
    if (s1 !== peg$FAILED) {
      s2 = peg$parse_();
      if (s2 !== peg$FAILED) {
        s3 = peg$parsegreater();
        if (s3 !== peg$FAILED) {
          s4 = peg$parse_();
          if (s4 !== peg$FAILED) {
            if (input.substr(peg$currPos, 4).toLowerCase() === peg$c172) {
              s5 = input.substr(peg$currPos, 4);
              peg$currPos += 4;
            } else {
              s5 = peg$FAILED;
              if (peg$silentFails === 0) { peg$fail(peg$c173); }
            }
            if (s5 !== peg$FAILED) {
              peg$savedPos = s0;
              s1 = peg$c174();
              s0 = s1;
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }
    if (s0 === peg$FAILED) {
      s0 = peg$currPos;
      if (input.substr(peg$currPos, 2).toLowerCase() === peg$c135) {
        s1 = input.substr(peg$currPos, 2);
        peg$currPos += 2;
      } else {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c136); }
      }
      if (s1 !== peg$FAILED) {
        s2 = peg$parse_();
        if (s2 !== peg$FAILED) {
          s3 = peg$parsesmaller();
          if (s3 !== peg$FAILED) {
            s4 = peg$parse_();
            if (s4 !== peg$FAILED) {
              if (input.substr(peg$currPos, 4).toLowerCase() === peg$c172) {
                s5 = input.substr(peg$currPos, 4);
                peg$currPos += 4;
              } else {
                s5 = peg$FAILED;
                if (peg$silentFails === 0) { peg$fail(peg$c173); }
              }
              if (s5 !== peg$FAILED) {
                peg$savedPos = s0;
                s1 = peg$c175();
                s0 = s1;
              } else {
                peg$currPos = s0;
                s0 = peg$FAILED;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
      if (s0 === peg$FAILED) {
        s0 = peg$currPos;
        if (input.substr(peg$currPos, 2).toLowerCase() === peg$c135) {
          s1 = input.substr(peg$currPos, 2);
          peg$currPos += 2;
        } else {
          s1 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c136); }
        }
        if (s1 !== peg$FAILED) {
          s2 = peg$parse_();
          if (s2 !== peg$FAILED) {
            if (input.substr(peg$currPos, 2).toLowerCase() === peg$c176) {
              s3 = input.substr(peg$currPos, 2);
              peg$currPos += 2;
            } else {
              s3 = peg$FAILED;
              if (peg$silentFails === 0) { peg$fail(peg$c177); }
            }
            if (s3 !== peg$FAILED) {
              s4 = peg$parse_();
              if (s4 !== peg$FAILED) {
                s5 = peg$parsegreat();
                if (s5 !== peg$FAILED) {
                  s6 = peg$parse_();
                  if (s6 !== peg$FAILED) {
                    if (input.substr(peg$currPos, 2).toLowerCase() === peg$c176) {
                      s7 = input.substr(peg$currPos, 2);
                      peg$currPos += 2;
                    } else {
                      s7 = peg$FAILED;
                      if (peg$silentFails === 0) { peg$fail(peg$c177); }
                    }
                    if (s7 !== peg$FAILED) {
                      peg$savedPos = s0;
                      s1 = peg$c178();
                      s0 = s1;
                    } else {
                      peg$currPos = s0;
                      s0 = peg$FAILED;
                    }
                  } else {
                    peg$currPos = s0;
                    s0 = peg$FAILED;
                  }
                } else {
                  peg$currPos = s0;
                  s0 = peg$FAILED;
                }
              } else {
                peg$currPos = s0;
                s0 = peg$FAILED;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
        if (s0 === peg$FAILED) {
          s0 = peg$currPos;
          if (input.substr(peg$currPos, 2).toLowerCase() === peg$c135) {
            s1 = input.substr(peg$currPos, 2);
            peg$currPos += 2;
          } else {
            s1 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$c136); }
          }
          if (s1 !== peg$FAILED) {
            s2 = peg$parse_();
            if (s2 !== peg$FAILED) {
              if (input.substr(peg$currPos, 2).toLowerCase() === peg$c176) {
                s3 = input.substr(peg$currPos, 2);
                peg$currPos += 2;
              } else {
                s3 = peg$FAILED;
                if (peg$silentFails === 0) { peg$fail(peg$c177); }
              }
              if (s3 !== peg$FAILED) {
                s4 = peg$parse_();
                if (s4 !== peg$FAILED) {
                  s5 = peg$parsesmall();
                  if (s5 !== peg$FAILED) {
                    s6 = peg$parse_();
                    if (s6 !== peg$FAILED) {
                      if (input.substr(peg$currPos, 2).toLowerCase() === peg$c176) {
                        s7 = input.substr(peg$currPos, 2);
                        peg$currPos += 2;
                      } else {
                        s7 = peg$FAILED;
                        if (peg$silentFails === 0) { peg$fail(peg$c177); }
                      }
                      if (s7 !== peg$FAILED) {
                        peg$savedPos = s0;
                        s1 = peg$c179();
                        s0 = s1;
                      } else {
                        peg$currPos = s0;
                        s0 = peg$FAILED;
                      }
                    } else {
                      peg$currPos = s0;
                      s0 = peg$FAILED;
                    }
                  } else {
                    peg$currPos = s0;
                    s0 = peg$FAILED;
                  }
                } else {
                  peg$currPos = s0;
                  s0 = peg$FAILED;
                }
              } else {
                peg$currPos = s0;
                s0 = peg$FAILED;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        }
      }
    }

    return s0;
  }

  function peg$parsearithmetic() {
    var s0, s1, s2, s3, s4, s5;

    s0 = peg$currPos;
    s1 = peg$parseproduct();
    if (s1 !== peg$FAILED) {
      s2 = [];
      s3 = peg$currPos;
      s4 = peg$parseadd();
      if (s4 === peg$FAILED) {
        s4 = peg$parsesubtract();
      }
      if (s4 !== peg$FAILED) {
        s5 = peg$parseproduct();
        if (s5 !== peg$FAILED) {
          s4 = [s4, s5];
          s3 = s4;
        } else {
          peg$currPos = s3;
          s3 = peg$FAILED;
        }
      } else {
        peg$currPos = s3;
        s3 = peg$FAILED;
      }
      if (s3 !== peg$FAILED) {
        while (s3 !== peg$FAILED) {
          s2.push(s3);
          s3 = peg$currPos;
          s4 = peg$parseadd();
          if (s4 === peg$FAILED) {
            s4 = peg$parsesubtract();
          }
          if (s4 !== peg$FAILED) {
            s5 = peg$parseproduct();
            if (s5 !== peg$FAILED) {
              s4 = [s4, s5];
              s3 = s4;
            } else {
              peg$currPos = s3;
              s3 = peg$FAILED;
            }
          } else {
            peg$currPos = s3;
            s3 = peg$FAILED;
          }
        }
      } else {
        s2 = peg$FAILED;
      }
      if (s2 !== peg$FAILED) {
        peg$savedPos = s0;
        s1 = peg$c180(s1, s2);
        s0 = s1;
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }
    if (s0 === peg$FAILED) {
      s0 = peg$parseproduct();
    }

    return s0;
  }

  function peg$parseproduct() {
    var s0, s1, s2, s3, s4, s5;

    s0 = peg$currPos;
    s1 = peg$parsesimple_expression();
    if (s1 !== peg$FAILED) {
      s2 = [];
      s3 = peg$currPos;
      s4 = peg$parsemultiply();
      if (s4 === peg$FAILED) {
        s4 = peg$parsedivide();
      }
      if (s4 !== peg$FAILED) {
        s5 = peg$parsesimple_expression();
        if (s5 !== peg$FAILED) {
          s4 = [s4, s5];
          s3 = s4;
        } else {
          peg$currPos = s3;
          s3 = peg$FAILED;
        }
      } else {
        peg$currPos = s3;
        s3 = peg$FAILED;
      }
      if (s3 !== peg$FAILED) {
        while (s3 !== peg$FAILED) {
          s2.push(s3);
          s3 = peg$currPos;
          s4 = peg$parsemultiply();
          if (s4 === peg$FAILED) {
            s4 = peg$parsedivide();
          }
          if (s4 !== peg$FAILED) {
            s5 = peg$parsesimple_expression();
            if (s5 !== peg$FAILED) {
              s4 = [s4, s5];
              s3 = s4;
            } else {
              peg$currPos = s3;
              s3 = peg$FAILED;
            }
          } else {
            peg$currPos = s3;
            s3 = peg$FAILED;
          }
        }
      } else {
        s2 = peg$FAILED;
      }
      if (s2 !== peg$FAILED) {
        peg$savedPos = s0;
        s1 = peg$c181(s1, s2);
        s0 = s1;
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }
    if (s0 === peg$FAILED) {
      s0 = peg$parsesimple_expression();
    }

    return s0;
  }

  function peg$parseadd() {
    var s0, s1, s2, s3, s4;

    s0 = peg$currPos;
    s1 = [];
    s2 = peg$parse_();
    while (s2 !== peg$FAILED) {
      s1.push(s2);
      s2 = peg$parse_();
    }
    if (s1 !== peg$FAILED) {
      if (input.charCodeAt(peg$currPos) === 43) {
        s2 = peg$c182;
        peg$currPos++;
      } else {
        s2 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c183); }
      }
      if (s2 === peg$FAILED) {
        if (input.substr(peg$currPos, 5) === peg$c184) {
          s2 = peg$c184;
          peg$currPos += 5;
        } else {
          s2 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c185); }
        }
        if (s2 === peg$FAILED) {
          if (input.substr(peg$currPos, 5) === peg$c186) {
            s2 = peg$c186;
            peg$currPos += 5;
          } else {
            s2 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$c187); }
          }
        }
      }
      if (s2 !== peg$FAILED) {
        s3 = [];
        s4 = peg$parse_();
        while (s4 !== peg$FAILED) {
          s3.push(s4);
          s4 = peg$parse_();
        }
        if (s3 !== peg$FAILED) {
          peg$savedPos = s0;
          s1 = peg$c188();
          s0 = s1;
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parsesubtract() {
    var s0, s1, s2, s3, s4;

    s0 = peg$currPos;
    s1 = [];
    s2 = peg$parse_();
    while (s2 !== peg$FAILED) {
      s1.push(s2);
      s2 = peg$parse_();
    }
    if (s1 !== peg$FAILED) {
      if (input.charCodeAt(peg$currPos) === 45) {
        s2 = peg$c110;
        peg$currPos++;
      } else {
        s2 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c111); }
      }
      if (s2 === peg$FAILED) {
        if (input.substr(peg$currPos, 6) === peg$c189) {
          s2 = peg$c189;
          peg$currPos += 6;
        } else {
          s2 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c190); }
        }
        if (s2 === peg$FAILED) {
          if (input.substr(peg$currPos, 8) === peg$c191) {
            s2 = peg$c191;
            peg$currPos += 8;
          } else {
            s2 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$c192); }
          }
        }
      }
      if (s2 !== peg$FAILED) {
        s3 = [];
        s4 = peg$parse_();
        while (s4 !== peg$FAILED) {
          s3.push(s4);
          s4 = peg$parse_();
        }
        if (s3 !== peg$FAILED) {
          peg$savedPos = s0;
          s1 = peg$c193();
          s0 = s1;
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parsemultiply() {
    var s0, s1, s2, s3, s4;

    s0 = peg$currPos;
    s1 = [];
    s2 = peg$parse_();
    while (s2 !== peg$FAILED) {
      s1.push(s2);
      s2 = peg$parse_();
    }
    if (s1 !== peg$FAILED) {
      if (input.charCodeAt(peg$currPos) === 42) {
        s2 = peg$c194;
        peg$currPos++;
      } else {
        s2 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c195); }
      }
      if (s2 === peg$FAILED) {
        if (input.substr(peg$currPos, 6) === peg$c196) {
          s2 = peg$c196;
          peg$currPos += 6;
        } else {
          s2 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c197); }
        }
        if (s2 === peg$FAILED) {
          if (input.substr(peg$currPos, 3) === peg$c198) {
            s2 = peg$c198;
            peg$currPos += 3;
          } else {
            s2 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$c199); }
          }
        }
      }
      if (s2 !== peg$FAILED) {
        s3 = [];
        s4 = peg$parse_();
        while (s4 !== peg$FAILED) {
          s3.push(s4);
          s4 = peg$parse_();
        }
        if (s3 !== peg$FAILED) {
          peg$savedPos = s0;
          s1 = peg$c200();
          s0 = s1;
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parsedivide() {
    var s0, s1, s2, s3, s4;

    s0 = peg$currPos;
    s1 = [];
    s2 = peg$parse_();
    while (s2 !== peg$FAILED) {
      s1.push(s2);
      s2 = peg$parse_();
    }
    if (s1 !== peg$FAILED) {
      if (input.charCodeAt(peg$currPos) === 47) {
        s2 = peg$c201;
        peg$currPos++;
      } else {
        s2 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c202); }
      }
      if (s2 === peg$FAILED) {
        if (input.substr(peg$currPos, 5) === peg$c203) {
          s2 = peg$c203;
          peg$currPos += 5;
        } else {
          s2 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c204); }
        }
        if (s2 === peg$FAILED) {
          if (input.substr(peg$currPos, 8) === peg$c205) {
            s2 = peg$c205;
            peg$currPos += 8;
          } else {
            s2 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$c206); }
          }
        }
      }
      if (s2 !== peg$FAILED) {
        s3 = [];
        s4 = peg$parse_();
        while (s4 !== peg$FAILED) {
          s3.push(s4);
          s4 = peg$parse_();
        }
        if (s3 !== peg$FAILED) {
          peg$savedPos = s0;
          s1 = peg$c207();
          s0 = s1;
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parsepronoun() {
    var s0, s1;

    s0 = peg$currPos;
    if (input.substr(peg$currPos, 4).toLowerCase() === peg$c208) {
      s1 = input.substr(peg$currPos, 4);
      peg$currPos += 4;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c209); }
    }
    if (s1 === peg$FAILED) {
      if (input.substr(peg$currPos, 4).toLowerCase() === peg$c210) {
        s1 = input.substr(peg$currPos, 4);
        peg$currPos += 4;
      } else {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c211); }
      }
      if (s1 === peg$FAILED) {
        if (input.substr(peg$currPos, 3).toLowerCase() === peg$c212) {
          s1 = input.substr(peg$currPos, 3);
          peg$currPos += 3;
        } else {
          s1 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c213); }
        }
        if (s1 === peg$FAILED) {
          if (input.substr(peg$currPos, 3).toLowerCase() === peg$c214) {
            s1 = input.substr(peg$currPos, 3);
            peg$currPos += 3;
          } else {
            s1 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$c215); }
          }
          if (s1 === peg$FAILED) {
            if (input.substr(peg$currPos, 3).toLowerCase() === peg$c216) {
              s1 = input.substr(peg$currPos, 3);
              peg$currPos += 3;
            } else {
              s1 = peg$FAILED;
              if (peg$silentFails === 0) { peg$fail(peg$c217); }
            }
            if (s1 === peg$FAILED) {
              if (input.substr(peg$currPos, 3).toLowerCase() === peg$c218) {
                s1 = input.substr(peg$currPos, 3);
                peg$currPos += 3;
              } else {
                s1 = peg$FAILED;
                if (peg$silentFails === 0) { peg$fail(peg$c219); }
              }
              if (s1 === peg$FAILED) {
                if (input.substr(peg$currPos, 3).toLowerCase() === peg$c220) {
                  s1 = input.substr(peg$currPos, 3);
                  peg$currPos += 3;
                } else {
                  s1 = peg$FAILED;
                  if (peg$silentFails === 0) { peg$fail(peg$c221); }
                }
                if (s1 === peg$FAILED) {
                  if (input.substr(peg$currPos, 3).toLowerCase() === peg$c222) {
                    s1 = input.substr(peg$currPos, 3);
                    peg$currPos += 3;
                  } else {
                    s1 = peg$FAILED;
                    if (peg$silentFails === 0) { peg$fail(peg$c223); }
                  }
                  if (s1 === peg$FAILED) {
                    if (input.substr(peg$currPos, 3).toLowerCase() === peg$c224) {
                      s1 = input.substr(peg$currPos, 3);
                      peg$currPos += 3;
                    } else {
                      s1 = peg$FAILED;
                      if (peg$silentFails === 0) { peg$fail(peg$c225); }
                    }
                    if (s1 === peg$FAILED) {
                      if (input.substr(peg$currPos, 3).toLowerCase() === peg$c226) {
                        s1 = input.substr(peg$currPos, 3);
                        peg$currPos += 3;
                      } else {
                        s1 = peg$FAILED;
                        if (peg$silentFails === 0) { peg$fail(peg$c227); }
                      }
                      if (s1 === peg$FAILED) {
                        if (input.substr(peg$currPos, 2).toLowerCase() === peg$c228) {
                          s1 = input.substr(peg$currPos, 2);
                          peg$currPos += 2;
                        } else {
                          s1 = peg$FAILED;
                          if (peg$silentFails === 0) { peg$fail(peg$c229); }
                        }
                        if (s1 === peg$FAILED) {
                          if (input.substr(peg$currPos, 2).toLowerCase() === peg$c230) {
                            s1 = input.substr(peg$currPos, 2);
                            peg$currPos += 2;
                          } else {
                            s1 = peg$FAILED;
                            if (peg$silentFails === 0) { peg$fail(peg$c231); }
                          }
                          if (s1 === peg$FAILED) {
                            if (input.substr(peg$currPos, 2).toLowerCase() === peg$c232) {
                              s1 = input.substr(peg$currPos, 2);
                              peg$currPos += 2;
                            } else {
                              s1 = peg$FAILED;
                              if (peg$silentFails === 0) { peg$fail(peg$c233); }
                            }
                            if (s1 === peg$FAILED) {
                              if (input.substr(peg$currPos, 2).toLowerCase() === peg$c234) {
                                s1 = input.substr(peg$currPos, 2);
                                peg$currPos += 2;
                              } else {
                                s1 = peg$FAILED;
                                if (peg$silentFails === 0) { peg$fail(peg$c235); }
                              }
                              if (s1 === peg$FAILED) {
                                if (input.substr(peg$currPos, 2).toLowerCase() === peg$c236) {
                                  s1 = input.substr(peg$currPos, 2);
                                  peg$currPos += 2;
                                } else {
                                  s1 = peg$FAILED;
                                  if (peg$silentFails === 0) { peg$fail(peg$c237); }
                                }
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
    if (s1 !== peg$FAILED) {
      peg$savedPos = s0;
      s1 = peg$c238(s1);
    }
    s0 = s1;

    return s0;
  }

  function peg$parselookup() {
    var s0, s1;

    s0 = peg$currPos;
    s1 = peg$parsevariable();
    if (s1 !== peg$FAILED) {
      peg$savedPos = s0;
      s1 = peg$c239(s1);
    }
    s0 = s1;

    return s0;
  }

  function peg$parsecommon_prefix() {
    var s0;

    if (input.substr(peg$currPos, 2).toLowerCase() === peg$c240) {
      s0 = input.substr(peg$currPos, 2);
      peg$currPos += 2;
    } else {
      s0 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c241); }
    }
    if (s0 === peg$FAILED) {
      if (input.substr(peg$currPos, 1).toLowerCase() === peg$c242) {
        s0 = input.charAt(peg$currPos);
        peg$currPos++;
      } else {
        s0 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c243); }
      }
      if (s0 === peg$FAILED) {
        if (input.substr(peg$currPos, 3).toLowerCase() === peg$c244) {
          s0 = input.substr(peg$currPos, 3);
          peg$currPos += 3;
        } else {
          s0 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c245); }
        }
        if (s0 === peg$FAILED) {
          if (input.substr(peg$currPos, 2).toLowerCase() === peg$c246) {
            s0 = input.substr(peg$currPos, 2);
            peg$currPos += 2;
          } else {
            s0 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$c247); }
          }
          if (s0 === peg$FAILED) {
            if (input.substr(peg$currPos, 4).toLowerCase() === peg$c248) {
              s0 = input.substr(peg$currPos, 4);
              peg$currPos += 4;
            } else {
              s0 = peg$FAILED;
              if (peg$silentFails === 0) { peg$fail(peg$c249); }
            }
          }
        }
      }
    }

    return s0;
  }

  function peg$parseuppercase_letter() {
    var s0;

    if (peg$c250.test(input.charAt(peg$currPos))) {
      s0 = input.charAt(peg$currPos);
      peg$currPos++;
    } else {
      s0 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c251); }
    }

    return s0;
  }

  function peg$parselowercase_letter() {
    var s0;

    if (peg$c252.test(input.charAt(peg$currPos))) {
      s0 = input.charAt(peg$currPos);
      peg$currPos++;
    } else {
      s0 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c253); }
    }

    return s0;
  }

  function peg$parseletter() {
    var s0;

    s0 = peg$parseuppercase_letter();
    if (s0 === peg$FAILED) {
      s0 = peg$parselowercase_letter();
    }

    return s0;
  }

  function peg$parsecommon_variable() {
    var s0, s1, s2, s3, s4, s5;

    s0 = peg$currPos;
    s1 = peg$parsecommon_prefix();
    if (s1 !== peg$FAILED) {
      s2 = [];
      s3 = peg$parse_();
      if (s3 !== peg$FAILED) {
        while (s3 !== peg$FAILED) {
          s2.push(s3);
          s3 = peg$parse_();
        }
      } else {
        s2 = peg$FAILED;
      }
      if (s2 !== peg$FAILED) {
        s3 = peg$currPos;
        s4 = [];
        s5 = peg$parseletter();
        if (s5 !== peg$FAILED) {
          while (s5 !== peg$FAILED) {
            s4.push(s5);
            s5 = peg$parseletter();
          }
        } else {
          s4 = peg$FAILED;
        }
        if (s4 !== peg$FAILED) {
          s3 = input.substring(s3, peg$currPos);
        } else {
          s3 = s4;
        }
        if (s3 !== peg$FAILED) {
          peg$savedPos = s0;
          s1 = peg$c254(s1, s3);
          s0 = s1;
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parseassignment() {
    var s0, s1, s2, s3, s4, s5, s6, s7;

    s0 = peg$currPos;
    s1 = peg$parsevariable();
    if (s1 !== peg$FAILED) {
      if (input.substr(peg$currPos, 2) === peg$c255) {
        s2 = peg$c255;
        peg$currPos += 2;
      } else {
        s2 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c256); }
      }
      if (s2 === peg$FAILED) {
        s2 = peg$currPos;
        s3 = [];
        s4 = peg$parse_();
        while (s4 !== peg$FAILED) {
          s3.push(s4);
          s4 = peg$parse_();
        }
        if (s3 !== peg$FAILED) {
          if (input.charCodeAt(peg$currPos) === 61) {
            s4 = peg$c257;
            peg$currPos++;
          } else {
            s4 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$c258); }
          }
          if (s4 === peg$FAILED) {
            if (input.substr(peg$currPos, 3).toLowerCase() === peg$c259) {
              s4 = input.substr(peg$currPos, 3);
              peg$currPos += 3;
            } else {
              s4 = peg$FAILED;
              if (peg$silentFails === 0) { peg$fail(peg$c260); }
            }
            if (s4 === peg$FAILED) {
              if (input.substr(peg$currPos, 4).toLowerCase() === peg$c261) {
                s4 = input.substr(peg$currPos, 4);
                peg$currPos += 4;
              } else {
                s4 = peg$FAILED;
                if (peg$silentFails === 0) { peg$fail(peg$c262); }
              }
              if (s4 === peg$FAILED) {
                if (input.substr(peg$currPos, 4).toLowerCase() === peg$c263) {
                  s4 = input.substr(peg$currPos, 4);
                  peg$currPos += 4;
                } else {
                  s4 = peg$FAILED;
                  if (peg$silentFails === 0) { peg$fail(peg$c264); }
                }
                if (s4 === peg$FAILED) {
                  if (input.substr(peg$currPos, 5).toLowerCase() === peg$c265) {
                    s4 = input.substr(peg$currPos, 5);
                    peg$currPos += 5;
                  } else {
                    s4 = peg$FAILED;
                    if (peg$silentFails === 0) { peg$fail(peg$c266); }
                  }
                }
              }
            }
          }
          if (s4 !== peg$FAILED) {
            s3 = [s3, s4];
            s2 = s3;
          } else {
            peg$currPos = s2;
            s2 = peg$FAILED;
          }
        } else {
          peg$currPos = s2;
          s2 = peg$FAILED;
        }
      }
      if (s2 !== peg$FAILED) {
        s3 = [];
        s4 = peg$parse_();
        while (s4 !== peg$FAILED) {
          s3.push(s4);
          s4 = peg$parse_();
        }
        if (s3 !== peg$FAILED) {
          s4 = peg$parseliteral();
          if (s4 === peg$FAILED) {
            s4 = peg$parsepoetic_number();
          }
          if (s4 !== peg$FAILED) {
            peg$savedPos = s0;
            s1 = peg$c267(s1, s4);
            s0 = s1;
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }
    if (s0 === peg$FAILED) {
      s0 = peg$currPos;
      s1 = peg$parsevariable();
      if (s1 !== peg$FAILED) {
        s2 = [];
        s3 = peg$parse_();
        if (s3 !== peg$FAILED) {
          while (s3 !== peg$FAILED) {
            s2.push(s3);
            s3 = peg$parse_();
          }
        } else {
          s2 = peg$FAILED;
        }
        if (s2 !== peg$FAILED) {
          if (input.substr(peg$currPos, 4).toLowerCase() === peg$c268) {
            s3 = input.substr(peg$currPos, 4);
            peg$currPos += 4;
          } else {
            s3 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$c269); }
          }
          if (s3 !== peg$FAILED) {
            s4 = [];
            s5 = peg$parse_();
            if (s5 !== peg$FAILED) {
              while (s5 !== peg$FAILED) {
                s4.push(s5);
                s5 = peg$parse_();
              }
            } else {
              s4 = peg$FAILED;
            }
            if (s4 !== peg$FAILED) {
              s5 = peg$parsepoetic_string();
              if (s5 !== peg$FAILED) {
                peg$savedPos = s0;
                s1 = peg$c267(s1, s5);
                s0 = s1;
              } else {
                peg$currPos = s0;
                s0 = peg$FAILED;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
      if (s0 === peg$FAILED) {
        s0 = peg$currPos;
        if (input.substr(peg$currPos, 3).toLowerCase() === peg$c270) {
          s1 = input.substr(peg$currPos, 3);
          peg$currPos += 3;
        } else {
          s1 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c271); }
        }
        if (s1 !== peg$FAILED) {
          s2 = [];
          s3 = peg$parse_();
          if (s3 !== peg$FAILED) {
            while (s3 !== peg$FAILED) {
              s2.push(s3);
              s3 = peg$parse_();
            }
          } else {
            s2 = peg$FAILED;
          }
          if (s2 !== peg$FAILED) {
            s3 = peg$parsenor();
            if (s3 !== peg$FAILED) {
              s4 = [];
              s5 = peg$parse_();
              if (s5 !== peg$FAILED) {
                while (s5 !== peg$FAILED) {
                  s4.push(s5);
                  s5 = peg$parse_();
                }
              } else {
                s4 = peg$FAILED;
              }
              if (s4 !== peg$FAILED) {
                if (input.substr(peg$currPos, 4).toLowerCase() === peg$c272) {
                  s5 = input.substr(peg$currPos, 4);
                  peg$currPos += 4;
                } else {
                  s5 = peg$FAILED;
                  if (peg$silentFails === 0) { peg$fail(peg$c273); }
                }
                if (s5 !== peg$FAILED) {
                  s6 = [];
                  s7 = peg$parse_();
                  if (s7 !== peg$FAILED) {
                    while (s7 !== peg$FAILED) {
                      s6.push(s7);
                      s7 = peg$parse_();
                    }
                  } else {
                    s6 = peg$FAILED;
                  }
                  if (s6 !== peg$FAILED) {
                    s7 = peg$parsevariable();
                    if (s7 !== peg$FAILED) {
                      peg$savedPos = s0;
                      s1 = peg$c274(s3, s7);
                      s0 = s1;
                    } else {
                      peg$currPos = s0;
                      s0 = peg$FAILED;
                    }
                  } else {
                    peg$currPos = s0;
                    s0 = peg$FAILED;
                  }
                } else {
                  peg$currPos = s0;
                  s0 = peg$FAILED;
                }
              } else {
                peg$currPos = s0;
                s0 = peg$FAILED;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      }
    }

    return s0;
  }

  function peg$parsepoetic_string() {
    var s0, s1, s2, s3;

    s0 = peg$currPos;
    s1 = peg$currPos;
    s2 = [];
    if (peg$c15.test(input.charAt(peg$currPos))) {
      s3 = input.charAt(peg$currPos);
      peg$currPos++;
    } else {
      s3 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c16); }
    }
    while (s3 !== peg$FAILED) {
      s2.push(s3);
      if (peg$c15.test(input.charAt(peg$currPos))) {
        s3 = input.charAt(peg$currPos);
        peg$currPos++;
      } else {
        s3 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c16); }
      }
    }
    if (s2 !== peg$FAILED) {
      s1 = input.substring(s1, peg$currPos);
    } else {
      s1 = s2;
    }
    if (s1 !== peg$FAILED) {
      peg$savedPos = s0;
      s1 = peg$c275(s1);
    }
    s0 = s1;

    return s0;
  }

  function peg$parsepoetic_number() {
    var s0, s1, s2, s3, s4, s5, s6;

    s0 = peg$currPos;
    s1 = [];
    s2 = peg$parsepoetic_digit_separator();
    while (s2 !== peg$FAILED) {
      s1.push(s2);
      s2 = peg$parsepoetic_digit_separator();
    }
    if (s1 !== peg$FAILED) {
      s2 = peg$parsepoetic_digits();
      if (s2 !== peg$FAILED) {
        s3 = [];
        s4 = peg$parsepoetic_digit_separator();
        while (s4 !== peg$FAILED) {
          s3.push(s4);
          s4 = peg$parsepoetic_digit_separator();
        }
        if (s3 !== peg$FAILED) {
          s4 = peg$parsepoetic_decimal();
          if (s4 === peg$FAILED) {
            s4 = null;
          }
          if (s4 !== peg$FAILED) {
            s5 = [];
            s6 = peg$parsepoetic_digit_separator();
            while (s6 !== peg$FAILED) {
              s5.push(s6);
              s6 = peg$parsepoetic_digit_separator();
            }
            if (s5 !== peg$FAILED) {
              peg$savedPos = s0;
              s1 = peg$c276(s2, s4);
              s0 = s1;
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parsepoetic_decimal() {
    var s0, s1, s2, s3, s4, s5;

    s0 = peg$currPos;
    if (input.charCodeAt(peg$currPos) === 46) {
      s1 = peg$c114;
      peg$currPos++;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c115); }
    }
    if (s1 !== peg$FAILED) {
      s2 = [];
      s3 = peg$parsepoetic_decimal_digit_separator();
      while (s3 !== peg$FAILED) {
        s2.push(s3);
        s3 = peg$parsepoetic_decimal_digit_separator();
      }
      if (s2 !== peg$FAILED) {
        s3 = peg$parsepoetic_decimal_digits();
        if (s3 !== peg$FAILED) {
          s4 = [];
          s5 = peg$parsepoetic_decimal_digit_separator();
          while (s5 !== peg$FAILED) {
            s4.push(s5);
            s5 = peg$parsepoetic_decimal_digit_separator();
          }
          if (s4 !== peg$FAILED) {
            peg$savedPos = s0;
            s1 = peg$c277(s3);
            s0 = s1;
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }
    if (s0 === peg$FAILED) {
      s0 = peg$currPos;
      if (input.charCodeAt(peg$currPos) === 46) {
        s1 = peg$c114;
        peg$currPos++;
      } else {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c115); }
      }
      if (s1 !== peg$FAILED) {
        s2 = [];
        s3 = peg$parsepoetic_decimal_digit_separator();
        while (s3 !== peg$FAILED) {
          s2.push(s3);
          s3 = peg$parsepoetic_decimal_digit_separator();
        }
        if (s2 !== peg$FAILED) {
          s1 = [s1, s2];
          s0 = s1;
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    }

    return s0;
  }

  function peg$parsepoetic_digit_separator() {
    var s0;

    s0 = peg$parse_();
    if (s0 === peg$FAILED) {
      if (peg$c278.test(input.charAt(peg$currPos))) {
        s0 = input.charAt(peg$currPos);
        peg$currPos++;
      } else {
        s0 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c279); }
      }
    }

    return s0;
  }

  function peg$parsepoetic_digits() {
    var s0, s1, s2, s3, s4;

    s0 = peg$currPos;
    s1 = [];
    s2 = peg$parsepoetic_digit_separator();
    while (s2 !== peg$FAILED) {
      s1.push(s2);
      s2 = peg$parsepoetic_digit_separator();
    }
    if (s1 !== peg$FAILED) {
      s2 = peg$parsepoetic_digit();
      if (s2 !== peg$FAILED) {
        s3 = [];
        s4 = peg$parsepoetic_digit_separator();
        if (s4 !== peg$FAILED) {
          while (s4 !== peg$FAILED) {
            s3.push(s4);
            s4 = peg$parsepoetic_digit_separator();
          }
        } else {
          s3 = peg$FAILED;
        }
        if (s3 !== peg$FAILED) {
          s4 = peg$parsepoetic_digits();
          if (s4 !== peg$FAILED) {
            peg$savedPos = s0;
            s1 = peg$c280(s2, s4);
            s0 = s1;
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }
    if (s0 === peg$FAILED) {
      s0 = peg$currPos;
      s1 = peg$parsepoetic_digit();
      if (s1 !== peg$FAILED) {
        peg$savedPos = s0;
        s1 = peg$c281(s1);
      }
      s0 = s1;
    }

    return s0;
  }

  function peg$parsepoetic_decimal_digit_separator() {
    var s0;

    s0 = peg$parse_();
    if (s0 === peg$FAILED) {
      s0 = peg$parsepoetic_digit_separator();
      if (s0 === peg$FAILED) {
        if (input.charCodeAt(peg$currPos) === 46) {
          s0 = peg$c114;
          peg$currPos++;
        } else {
          s0 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c115); }
        }
      }
    }

    return s0;
  }

  function peg$parsepoetic_decimal_digits() {
    var s0, s1, s2, s3, s4;

    s0 = peg$currPos;
    s1 = [];
    s2 = peg$parsepoetic_decimal_digit_separator();
    while (s2 !== peg$FAILED) {
      s1.push(s2);
      s2 = peg$parsepoetic_decimal_digit_separator();
    }
    if (s1 !== peg$FAILED) {
      s2 = peg$parsepoetic_digit();
      if (s2 !== peg$FAILED) {
        s3 = [];
        s4 = peg$parsepoetic_decimal_digit_separator();
        if (s4 !== peg$FAILED) {
          while (s4 !== peg$FAILED) {
            s3.push(s4);
            s4 = peg$parsepoetic_decimal_digit_separator();
          }
        } else {
          s3 = peg$FAILED;
        }
        if (s3 !== peg$FAILED) {
          s4 = peg$parsepoetic_decimal_digits();
          if (s4 !== peg$FAILED) {
            peg$savedPos = s0;
            s1 = peg$c280(s2, s4);
            s0 = s1;
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }
    if (s0 === peg$FAILED) {
      s0 = peg$currPos;
      s1 = peg$parsepoetic_digit();
      if (s1 !== peg$FAILED) {
        peg$savedPos = s0;
        s1 = peg$c281(s1);
      }
      s0 = s1;
    }

    return s0;
  }

  function peg$parsepoetic_digit() {
    var s0, s1, s2;

    s0 = peg$currPos;
    s1 = [];
    if (peg$c282.test(input.charAt(peg$currPos))) {
      s2 = input.charAt(peg$currPos);
      peg$currPos++;
    } else {
      s2 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c283); }
    }
    if (s2 !== peg$FAILED) {
      while (s2 !== peg$FAILED) {
        s1.push(s2);
        if (peg$c282.test(input.charAt(peg$currPos))) {
          s2 = input.charAt(peg$currPos);
          peg$currPos++;
        } else {
          s2 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c283); }
        }
      }
    } else {
      s1 = peg$FAILED;
    }
    if (s1 !== peg$FAILED) {
      peg$savedPos = s0;
      s1 = peg$c284(s1);
    }
    s0 = s1;

    return s0;
  }

  function peg$parsevariable() {
    var s0;

    s0 = peg$parsecommon_variable();
    if (s0 === peg$FAILED) {
      s0 = peg$parseproper_variable();
      if (s0 === peg$FAILED) {
        s0 = peg$parsepronoun();
      }
    }

    return s0;
  }

  function peg$parsekw10() {
    var s0;

    if (input.substr(peg$currPos, 10).toLowerCase() === peg$c107) {
      s0 = input.substr(peg$currPos, 10);
      peg$currPos += 10;
    } else {
      s0 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c285); }
    }

    return s0;
  }

  function peg$parsekw8() {
    var s0;

    if (input.substr(peg$currPos, 8).toLowerCase() === peg$c148) {
      s0 = input.substr(peg$currPos, 8);
      peg$currPos += 8;
    } else {
      s0 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c149); }
    }
    if (s0 === peg$FAILED) {
      if (input.substr(peg$currPos, 8).toLowerCase() === peg$c20) {
        s0 = input.substr(peg$currPos, 8);
        peg$currPos += 8;
      } else {
        s0 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c21); }
      }
    }

    return s0;
  }

  function peg$parsekw7() {
    var s0;

    if (input.substr(peg$currPos, 7).toLowerCase() === peg$c286) {
      s0 = input.substr(peg$currPos, 7);
      peg$currPos += 7;
    } else {
      s0 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c287); }
    }
    if (s0 === peg$FAILED) {
      if (input.substr(peg$currPos, 7).toLowerCase() === peg$c144) {
        s0 = input.substr(peg$currPos, 7);
        peg$currPos += 7;
      } else {
        s0 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c145); }
      }
      if (s0 === peg$FAILED) {
        if (input.substr(peg$currPos, 7).toLowerCase() === peg$c96) {
          s0 = input.substr(peg$currPos, 7);
          peg$currPos += 7;
        } else {
          s0 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c97); }
        }
        if (s0 === peg$FAILED) {
          if (input.substr(peg$currPos, 7).toLowerCase() === peg$c98) {
            s0 = input.substr(peg$currPos, 7);
            peg$currPos += 7;
          } else {
            s0 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$c99); }
          }
          if (s0 === peg$FAILED) {
            if (input.substr(peg$currPos, 7).toLowerCase() === peg$c154) {
              s0 = input.substr(peg$currPos, 7);
              peg$currPos += 7;
            } else {
              s0 = peg$FAILED;
              if (peg$silentFails === 0) { peg$fail(peg$c155); }
            }
            if (s0 === peg$FAILED) {
              if (input.substr(peg$currPos, 7).toLowerCase() === peg$c71) {
                s0 = input.substr(peg$currPos, 7);
                peg$currPos += 7;
              } else {
                s0 = peg$FAILED;
                if (peg$silentFails === 0) { peg$fail(peg$c72); }
              }
              if (s0 === peg$FAILED) {
                if (input.substr(peg$currPos, 7).toLowerCase() === peg$c288) {
                  s0 = input.substr(peg$currPos, 7);
                  peg$currPos += 7;
                } else {
                  s0 = peg$FAILED;
                  if (peg$silentFails === 0) { peg$fail(peg$c289); }
                }
              }
            }
          }
        }
      }
    }

    return s0;
  }

  function peg$parsekw6() {
    var s0;

    if (input.substr(peg$currPos, 5).toLowerCase() === peg$c132) {
      s0 = input.substr(peg$currPos, 5);
      peg$currPos += 5;
    } else {
      s0 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c133); }
    }
    if (s0 === peg$FAILED) {
      if (input.substr(peg$currPos, 6).toLowerCase() === peg$c146) {
        s0 = input.substr(peg$currPos, 6);
        peg$currPos += 6;
      } else {
        s0 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c147); }
      }
      if (s0 === peg$FAILED) {
        if (input.substr(peg$currPos, 6).toLowerCase() === peg$c51) {
          s0 = input.substr(peg$currPos, 6);
          peg$currPos += 6;
        } else {
          s0 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c52); }
        }
        if (s0 === peg$FAILED) {
          if (input.substr(peg$currPos, 6).toLowerCase() === peg$c100) {
            s0 = input.substr(peg$currPos, 6);
            peg$currPos += 6;
          } else {
            s0 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$c101); }
          }
          if (s0 === peg$FAILED) {
            if (input.substr(peg$currPos, 6).toLowerCase() === peg$c43) {
              s0 = input.substr(peg$currPos, 6);
              peg$currPos += 6;
            } else {
              s0 = peg$FAILED;
              if (peg$silentFails === 0) { peg$fail(peg$c44); }
            }
            if (s0 === peg$FAILED) {
              if (input.substr(peg$currPos, 6).toLowerCase() === peg$c73) {
                s0 = input.substr(peg$currPos, 6);
                peg$currPos += 6;
              } else {
                s0 = peg$FAILED;
                if (peg$silentFails === 0) { peg$fail(peg$c74); }
              }
              if (s0 === peg$FAILED) {
                if (input.substr(peg$currPos, 6).toLowerCase() === peg$c40) {
                  s0 = input.substr(peg$currPos, 6);
                  peg$currPos += 6;
                } else {
                  s0 = peg$FAILED;
                  if (peg$silentFails === 0) { peg$fail(peg$c41); }
                }
                if (s0 === peg$FAILED) {
                  if (input.substr(peg$currPos, 6).toLowerCase() === peg$c156) {
                    s0 = input.substr(peg$currPos, 6);
                    peg$currPos += 6;
                  } else {
                    s0 = peg$FAILED;
                    if (peg$silentFails === 0) { peg$fail(peg$c157); }
                  }
                  if (s0 === peg$FAILED) {
                    if (input.substr(peg$currPos, 6).toLowerCase() === peg$c142) {
                      s0 = input.substr(peg$currPos, 6);
                      peg$currPos += 6;
                    } else {
                      s0 = peg$FAILED;
                      if (peg$silentFails === 0) { peg$fail(peg$c143); }
                    }
                    if (s0 === peg$FAILED) {
                      if (input.substr(peg$currPos, 6).toLowerCase() === peg$c164) {
                        s0 = input.substr(peg$currPos, 6);
                        peg$currPos += 6;
                      } else {
                        s0 = peg$FAILED;
                        if (peg$silentFails === 0) { peg$fail(peg$c165); }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }

    return s0;
  }

  function peg$parsekw5() {
    var s0;

    if (input.substr(peg$currPos, 5).toLowerCase() === peg$c17) {
      s0 = input.substr(peg$currPos, 5);
      peg$currPos += 5;
    } else {
      s0 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c18); }
    }
    if (s0 === peg$FAILED) {
      if (input.substr(peg$currPos, 5).toLowerCase() === peg$c290) {
        s0 = input.substr(peg$currPos, 5);
        peg$currPos += 5;
      } else {
        s0 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c291); }
      }
      if (s0 === peg$FAILED) {
        if (input.substr(peg$currPos, 5).toLowerCase() === peg$c102) {
          s0 = input.substr(peg$currPos, 5);
          peg$currPos += 5;
        } else {
          s0 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c103); }
        }
        if (s0 === peg$FAILED) {
          if (input.substr(peg$currPos, 5).toLowerCase() === peg$c85) {
            s0 = input.substr(peg$currPos, 5);
            peg$currPos += 5;
          } else {
            s0 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$c86); }
          }
          if (s0 === peg$FAILED) {
            if (input.substr(peg$currPos, 5).toLowerCase() === peg$c160) {
              s0 = input.substr(peg$currPos, 5);
              peg$currPos += 5;
            } else {
              s0 = peg$FAILED;
              if (peg$silentFails === 0) { peg$fail(peg$c161); }
            }
            if (s0 === peg$FAILED) {
              if (input.substr(peg$currPos, 5).toLowerCase() === peg$c292) {
                s0 = input.substr(peg$currPos, 5);
                peg$currPos += 5;
              } else {
                s0 = peg$FAILED;
                if (peg$silentFails === 0) { peg$fail(peg$c293); }
              }
              if (s0 === peg$FAILED) {
                if (input.substr(peg$currPos, 5).toLowerCase() === peg$c150) {
                  s0 = input.substr(peg$currPos, 5);
                  peg$currPos += 5;
                } else {
                  s0 = peg$FAILED;
                  if (peg$silentFails === 0) { peg$fail(peg$c151); }
                }
                if (s0 === peg$FAILED) {
                  if (input.substr(peg$currPos, 5).toLowerCase() === peg$c80) {
                    s0 = input.substr(peg$currPos, 5);
                    peg$currPos += 5;
                  } else {
                    s0 = peg$FAILED;
                    if (peg$silentFails === 0) { peg$fail(peg$c81); }
                  }
                  if (s0 === peg$FAILED) {
                    if (input.substr(peg$currPos, 5).toLowerCase() === peg$c69) {
                      s0 = input.substr(peg$currPos, 5);
                      peg$currPos += 5;
                    } else {
                      s0 = peg$FAILED;
                      if (peg$silentFails === 0) { peg$fail(peg$c70); }
                    }
                    if (s0 === peg$FAILED) {
                      if (input.substr(peg$currPos, 5).toLowerCase() === peg$c168) {
                        s0 = input.substr(peg$currPos, 5);
                        peg$currPos += 5;
                      } else {
                        s0 = peg$FAILED;
                        if (peg$silentFails === 0) { peg$fail(peg$c169); }
                      }
                      if (s0 === peg$FAILED) {
                        if (input.substr(peg$currPos, 5).toLowerCase() === peg$c294) {
                          s0 = input.substr(peg$currPos, 5);
                          peg$currPos += 5;
                        } else {
                          s0 = peg$FAILED;
                          if (peg$silentFails === 0) { peg$fail(peg$c295); }
                        }
                        if (s0 === peg$FAILED) {
                          if (input.substr(peg$currPos, 5).toLowerCase() === peg$c25) {
                            s0 = input.substr(peg$currPos, 5);
                            peg$currPos += 5;
                          } else {
                            s0 = peg$FAILED;
                            if (peg$silentFails === 0) { peg$fail(peg$c26); }
                          }
                          if (s0 === peg$FAILED) {
                            if (input.substr(peg$currPos, 5).toLowerCase() === peg$c296) {
                              s0 = input.substr(peg$currPos, 5);
                              peg$currPos += 5;
                            } else {
                              s0 = peg$FAILED;
                              if (peg$silentFails === 0) { peg$fail(peg$c297); }
                            }
                            if (s0 === peg$FAILED) {
                              if (input.substr(peg$currPos, 5).toLowerCase() === peg$c64) {
                                s0 = input.substr(peg$currPos, 5);
                                peg$currPos += 5;
                              } else {
                                s0 = peg$FAILED;
                                if (peg$silentFails === 0) { peg$fail(peg$c65); }
                              }
                              if (s0 === peg$FAILED) {
                                if (input.substr(peg$currPos, 5).toLowerCase() === peg$c61) {
                                  s0 = input.substr(peg$currPos, 5);
                                  peg$currPos += 5;
                                } else {
                                  s0 = peg$FAILED;
                                  if (peg$silentFails === 0) { peg$fail(peg$c62); }
                                }
                                if (s0 === peg$FAILED) {
                                  if (input.substr(peg$currPos, 5).toLowerCase() === peg$c89) {
                                    s0 = input.substr(peg$currPos, 5);
                                    peg$currPos += 5;
                                  } else {
                                    s0 = peg$FAILED;
                                    if (peg$silentFails === 0) { peg$fail(peg$c90); }
                                  }
                                  if (s0 === peg$FAILED) {
                                    if (input.substr(peg$currPos, 5).toLowerCase() === peg$c298) {
                                      s0 = input.substr(peg$currPos, 5);
                                      peg$currPos += 5;
                                    } else {
                                      s0 = peg$FAILED;
                                      if (peg$silentFails === 0) { peg$fail(peg$c299); }
                                    }
                                  }
                                }
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }

    return s0;
  }

  function peg$parsekw4() {
    var s0;

    if (input.substr(peg$currPos, 4).toLowerCase() === peg$c130) {
      s0 = input.substr(peg$currPos, 4);
      peg$currPos += 4;
    } else {
      s0 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c131); }
    }
    if (s0 === peg$FAILED) {
      if (input.substr(peg$currPos, 4).toLowerCase() === peg$c300) {
        s0 = input.substr(peg$currPos, 4);
        peg$currPos += 4;
      } else {
        s0 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c301); }
      }
      if (s0 === peg$FAILED) {
        if (input.substr(peg$currPos, 4).toLowerCase() === peg$c302) {
          s0 = input.substr(peg$currPos, 4);
          peg$currPos += 4;
        } else {
          s0 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c303); }
        }
        if (s0 === peg$FAILED) {
          if (input.substr(peg$currPos, 4).toLowerCase() === peg$c55) {
            s0 = input.substr(peg$currPos, 4);
            peg$currPos += 4;
          } else {
            s0 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$c56); }
          }
          if (s0 === peg$FAILED) {
            if (input.substr(peg$currPos, 4).toLowerCase() === peg$c304) {
              s0 = input.substr(peg$currPos, 4);
              peg$currPos += 4;
            } else {
              s0 = peg$FAILED;
              if (peg$silentFails === 0) { peg$fail(peg$c305); }
            }
            if (s0 === peg$FAILED) {
              if (input.substr(peg$currPos, 4).toLowerCase() === peg$c104) {
                s0 = input.substr(peg$currPos, 4);
                peg$currPos += 4;
              } else {
                s0 = peg$FAILED;
                if (peg$silentFails === 0) { peg$fail(peg$c105); }
              }
              if (s0 === peg$FAILED) {
                if (input.substr(peg$currPos, 4).toLowerCase() === peg$c158) {
                  s0 = input.substr(peg$currPos, 4);
                  peg$currPos += 4;
                } else {
                  s0 = peg$FAILED;
                  if (peg$silentFails === 0) { peg$fail(peg$c159); }
                }
                if (s0 === peg$FAILED) {
                  if (input.substr(peg$currPos, 4).toLowerCase() === peg$c272) {
                    s0 = input.substr(peg$currPos, 4);
                    peg$currPos += 4;
                  } else {
                    s0 = peg$FAILED;
                    if (peg$silentFails === 0) { peg$fail(peg$c273); }
                  }
                  if (s0 === peg$FAILED) {
                    if (input.substr(peg$currPos, 4).toLowerCase() === peg$c152) {
                      s0 = input.substr(peg$currPos, 4);
                      peg$currPos += 4;
                    } else {
                      s0 = peg$FAILED;
                      if (peg$silentFails === 0) { peg$fail(peg$c153); }
                    }
                    if (s0 === peg$FAILED) {
                      if (input.substr(peg$currPos, 4).toLowerCase() === peg$c87) {
                        s0 = input.substr(peg$currPos, 4);
                        peg$currPos += 4;
                      } else {
                        s0 = peg$FAILED;
                        if (peg$silentFails === 0) { peg$fail(peg$c88); }
                      }
                      if (s0 === peg$FAILED) {
                        if (input.substr(peg$currPos, 4).toLowerCase() === peg$c94) {
                          s0 = input.substr(peg$currPos, 4);
                          peg$currPos += 4;
                        } else {
                          s0 = peg$FAILED;
                          if (peg$silentFails === 0) { peg$fail(peg$c95); }
                        }
                        if (s0 === peg$FAILED) {
                          if (input.substr(peg$currPos, 4).toLowerCase() === peg$c306) {
                            s0 = input.substr(peg$currPos, 4);
                            peg$currPos += 4;
                          } else {
                            s0 = peg$FAILED;
                            if (peg$silentFails === 0) { peg$fail(peg$c307); }
                          }
                          if (s0 === peg$FAILED) {
                            if (input.substr(peg$currPos, 4).toLowerCase() === peg$c268) {
                              s0 = input.substr(peg$currPos, 4);
                              peg$currPos += 4;
                            } else {
                              s0 = peg$FAILED;
                              if (peg$silentFails === 0) { peg$fail(peg$c269); }
                            }
                            if (s0 === peg$FAILED) {
                              if (input.substr(peg$currPos, 4).toLowerCase() === peg$c172) {
                                s0 = input.substr(peg$currPos, 4);
                                peg$currPos += 4;
                              } else {
                                s0 = peg$FAILED;
                                if (peg$silentFails === 0) { peg$fail(peg$c173); }
                              }
                              if (s0 === peg$FAILED) {
                                if (input.substr(peg$currPos, 4).toLowerCase() === peg$c210) {
                                  s0 = input.substr(peg$currPos, 4);
                                  peg$currPos += 4;
                                } else {
                                  s0 = peg$FAILED;
                                  if (peg$silentFails === 0) { peg$fail(peg$c211); }
                                }
                                if (s0 === peg$FAILED) {
                                  if (input.substr(peg$currPos, 4).toLowerCase() === peg$c208) {
                                    s0 = input.substr(peg$currPos, 4);
                                    peg$currPos += 4;
                                  } else {
                                    s0 = peg$FAILED;
                                    if (peg$silentFails === 0) { peg$fail(peg$c209); }
                                  }
                                  if (s0 === peg$FAILED) {
                                    if (input.substr(peg$currPos, 4).toLowerCase() === peg$c76) {
                                      s0 = input.substr(peg$currPos, 4);
                                      peg$currPos += 4;
                                    } else {
                                      s0 = peg$FAILED;
                                      if (peg$silentFails === 0) { peg$fail(peg$c77); }
                                    }
                                    if (s0 === peg$FAILED) {
                                      if (input.substr(peg$currPos, 4).toLowerCase() === peg$c170) {
                                        s0 = input.substr(peg$currPos, 4);
                                        peg$currPos += 4;
                                      } else {
                                        s0 = peg$FAILED;
                                        if (peg$silentFails === 0) { peg$fail(peg$c171); }
                                      }
                                      if (s0 === peg$FAILED) {
                                        if (input.substr(peg$currPos, 4).toLowerCase() === peg$c308) {
                                          s0 = input.substr(peg$currPos, 4);
                                          peg$currPos += 4;
                                        } else {
                                          s0 = peg$FAILED;
                                          if (peg$silentFails === 0) { peg$fail(peg$c309); }
                                        }
                                        if (s0 === peg$FAILED) {
                                          if (input.substr(peg$currPos, 4).toLowerCase() === peg$c248) {
                                            s0 = input.substr(peg$currPos, 4);
                                            peg$currPos += 4;
                                          } else {
                                            s0 = peg$FAILED;
                                            if (peg$silentFails === 0) { peg$fail(peg$c249); }
                                          }
                                          if (s0 === peg$FAILED) {
                                            if (input.substr(peg$currPos, 4).toLowerCase() === peg$c310) {
                                              s0 = input.substr(peg$currPos, 4);
                                              peg$currPos += 4;
                                            } else {
                                              s0 = peg$FAILED;
                                              if (peg$silentFails === 0) { peg$fail(peg$c311); }
                                            }
                                            if (s0 === peg$FAILED) {
                                              if (input.substr(peg$currPos, 4).toLowerCase() === peg$c312) {
                                                s0 = input.substr(peg$currPos, 4);
                                                peg$currPos += 4;
                                              } else {
                                                s0 = peg$FAILED;
                                                if (peg$silentFails === 0) { peg$fail(peg$c313); }
                                              }
                                            }
                                          }
                                        }
                                      }
                                    }
                                  }
                                }
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }

    return s0;
  }

  function peg$parsekw3() {
    var s0;

    if (input.substr(peg$currPos, 3).toLowerCase() === peg$c30) {
      s0 = input.substr(peg$currPos, 3);
      peg$currPos += 3;
    } else {
      s0 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c314); }
    }
    if (s0 === peg$FAILED) {
      if (input.substr(peg$currPos, 3).toLowerCase() === peg$c162) {
        s0 = input.substr(peg$currPos, 3);
        peg$currPos += 3;
      } else {
        s0 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c163); }
      }
      if (s0 === peg$FAILED) {
        if (input.substr(peg$currPos, 3).toLowerCase() === peg$c216) {
          s0 = input.substr(peg$currPos, 3);
          peg$currPos += 3;
        } else {
          s0 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c217); }
        }
        if (s0 === peg$FAILED) {
          if (input.substr(peg$currPos, 3).toLowerCase() === peg$c214) {
            s0 = input.substr(peg$currPos, 3);
            peg$currPos += 3;
          } else {
            s0 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$c215); }
          }
          if (s0 === peg$FAILED) {
            if (input.substr(peg$currPos, 3).toLowerCase() === peg$c218) {
              s0 = input.substr(peg$currPos, 3);
              peg$currPos += 3;
            } else {
              s0 = peg$FAILED;
              if (peg$silentFails === 0) { peg$fail(peg$c219); }
            }
            if (s0 === peg$FAILED) {
              if (input.substr(peg$currPos, 3).toLowerCase() === peg$c315) {
                s0 = input.substr(peg$currPos, 3);
                peg$currPos += 3;
              } else {
                s0 = peg$FAILED;
                if (peg$silentFails === 0) { peg$fail(peg$c316); }
              }
              if (s0 === peg$FAILED) {
                if (input.substr(peg$currPos, 3).toLowerCase() === peg$c166) {
                  s0 = input.substr(peg$currPos, 3);
                  peg$currPos += 3;
                } else {
                  s0 = peg$FAILED;
                  if (peg$silentFails === 0) { peg$fail(peg$c167); }
                }
                if (s0 === peg$FAILED) {
                  if (input.substr(peg$currPos, 3).toLowerCase() === peg$c123) {
                    s0 = input.substr(peg$currPos, 3);
                    peg$currPos += 3;
                  } else {
                    s0 = peg$FAILED;
                    if (peg$silentFails === 0) { peg$fail(peg$c317); }
                  }
                  if (s0 === peg$FAILED) {
                    if (input.substr(peg$currPos, 3).toLowerCase() === peg$c139) {
                      s0 = input.substr(peg$currPos, 3);
                      peg$currPos += 3;
                    } else {
                      s0 = peg$FAILED;
                      if (peg$silentFails === 0) { peg$fail(peg$c318); }
                    }
                    if (s0 === peg$FAILED) {
                      if (input.substr(peg$currPos, 3).toLowerCase() === peg$c270) {
                        s0 = input.substr(peg$currPos, 3);
                        peg$currPos += 3;
                      } else {
                        s0 = peg$FAILED;
                        if (peg$silentFails === 0) { peg$fail(peg$c271); }
                      }
                      if (s0 === peg$FAILED) {
                        if (input.substr(peg$currPos, 3).toLowerCase() === peg$c67) {
                          s0 = input.substr(peg$currPos, 3);
                          peg$currPos += 3;
                        } else {
                          s0 = peg$FAILED;
                          if (peg$silentFails === 0) { peg$fail(peg$c68); }
                        }
                        if (s0 === peg$FAILED) {
                          if (input.substr(peg$currPos, 3).toLowerCase() === peg$c212) {
                            s0 = input.substr(peg$currPos, 3);
                            peg$currPos += 3;
                          } else {
                            s0 = peg$FAILED;
                            if (peg$silentFails === 0) { peg$fail(peg$c213); }
                          }
                          if (s0 === peg$FAILED) {
                            if (input.substr(peg$currPos, 3).toLowerCase() === peg$c244) {
                              s0 = input.substr(peg$currPos, 3);
                              peg$currPos += 3;
                            } else {
                              s0 = peg$FAILED;
                              if (peg$silentFails === 0) { peg$fail(peg$c245); }
                            }
                            if (s0 === peg$FAILED) {
                              if (input.substr(peg$currPos, 3).toLowerCase() === peg$c319) {
                                s0 = input.substr(peg$currPos, 3);
                                peg$currPos += 3;
                              } else {
                                s0 = peg$FAILED;
                                if (peg$silentFails === 0) { peg$fail(peg$c320); }
                              }
                              if (s0 === peg$FAILED) {
                                if (input.substr(peg$currPos, 3).toLowerCase() === peg$c226) {
                                  s0 = input.substr(peg$currPos, 3);
                                  peg$currPos += 3;
                                } else {
                                  s0 = peg$FAILED;
                                  if (peg$silentFails === 0) { peg$fail(peg$c227); }
                                }
                                if (s0 === peg$FAILED) {
                                  if (input.substr(peg$currPos, 3).toLowerCase() === peg$c321) {
                                    s0 = input.substr(peg$currPos, 3);
                                    peg$currPos += 3;
                                  } else {
                                    s0 = peg$FAILED;
                                    if (peg$silentFails === 0) { peg$fail(peg$c322); }
                                  }
                                  if (s0 === peg$FAILED) {
                                    if (input.substr(peg$currPos, 3).toLowerCase() === peg$c224) {
                                      s0 = input.substr(peg$currPos, 3);
                                      peg$currPos += 3;
                                    } else {
                                      s0 = peg$FAILED;
                                      if (peg$silentFails === 0) { peg$fail(peg$c225); }
                                    }
                                    if (s0 === peg$FAILED) {
                                      if (input.substr(peg$currPos, 3).toLowerCase() === peg$c82) {
                                        s0 = input.substr(peg$currPos, 3);
                                        peg$currPos += 3;
                                      } else {
                                        s0 = peg$FAILED;
                                        if (peg$silentFails === 0) { peg$fail(peg$c83); }
                                      }
                                      if (s0 === peg$FAILED) {
                                        if (input.substr(peg$currPos, 3).toLowerCase() === peg$c220) {
                                          s0 = input.substr(peg$currPos, 3);
                                          peg$currPos += 3;
                                        } else {
                                          s0 = peg$FAILED;
                                          if (peg$silentFails === 0) { peg$fail(peg$c221); }
                                        }
                                        if (s0 === peg$FAILED) {
                                          if (input.substr(peg$currPos, 3).toLowerCase() === peg$c222) {
                                            s0 = input.substr(peg$currPos, 3);
                                            peg$currPos += 3;
                                          } else {
                                            s0 = peg$FAILED;
                                            if (peg$silentFails === 0) { peg$fail(peg$c223); }
                                          }
                                        }
                                      }
                                    }
                                  }
                                }
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }

    return s0;
  }

  function peg$parsekw2() {
    var s0;

    if (input.substr(peg$currPos, 2).toLowerCase() === peg$c240) {
      s0 = input.substr(peg$currPos, 2);
      peg$currPos += 2;
    } else {
      s0 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c241); }
    }
    if (s0 === peg$FAILED) {
      if (input.substr(peg$currPos, 2).toLowerCase() === peg$c176) {
        s0 = input.substr(peg$currPos, 2);
        peg$currPos += 2;
      } else {
        s0 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c177); }
      }
      if (s0 === peg$FAILED) {
        if (input.substr(peg$currPos, 2).toLowerCase() === peg$c236) {
          s0 = input.substr(peg$currPos, 2);
          peg$currPos += 2;
        } else {
          s0 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c237); }
        }
        if (s0 === peg$FAILED) {
          if (input.substr(peg$currPos, 2).toLowerCase() === peg$c58) {
            s0 = input.substr(peg$currPos, 2);
            peg$currPos += 2;
          } else {
            s0 = peg$FAILED;
            if (peg$silentFails === 0) { peg$fail(peg$c59); }
          }
          if (s0 === peg$FAILED) {
            if (input.substr(peg$currPos, 2).toLowerCase() === peg$c135) {
              s0 = input.substr(peg$currPos, 2);
              peg$currPos += 2;
            } else {
              s0 = peg$FAILED;
              if (peg$silentFails === 0) { peg$fail(peg$c136); }
            }
            if (s0 === peg$FAILED) {
              if (input.substr(peg$currPos, 2).toLowerCase() === peg$c234) {
                s0 = input.substr(peg$currPos, 2);
                peg$currPos += 2;
              } else {
                s0 = peg$FAILED;
                if (peg$silentFails === 0) { peg$fail(peg$c235); }
              }
              if (s0 === peg$FAILED) {
                if (input.substr(peg$currPos, 2).toLowerCase() === peg$c246) {
                  s0 = input.substr(peg$currPos, 2);
                  peg$currPos += 2;
                } else {
                  s0 = peg$FAILED;
                  if (peg$silentFails === 0) { peg$fail(peg$c247); }
                }
                if (s0 === peg$FAILED) {
                  if (input.substr(peg$currPos, 2).toLowerCase() === peg$c91) {
                    s0 = input.substr(peg$currPos, 2);
                    peg$currPos += 2;
                  } else {
                    s0 = peg$FAILED;
                    if (peg$silentFails === 0) { peg$fail(peg$c92); }
                  }
                  if (s0 === peg$FAILED) {
                    if (input.substr(peg$currPos, 2).toLowerCase() === peg$c323) {
                      s0 = input.substr(peg$currPos, 2);
                      peg$currPos += 2;
                    } else {
                      s0 = peg$FAILED;
                      if (peg$silentFails === 0) { peg$fail(peg$c324); }
                    }
                    if (s0 === peg$FAILED) {
                      if (input.substr(peg$currPos, 2).toLowerCase() === peg$c78) {
                        s0 = input.substr(peg$currPos, 2);
                        peg$currPos += 2;
                      } else {
                        s0 = peg$FAILED;
                        if (peg$silentFails === 0) { peg$fail(peg$c79); }
                      }
                      if (s0 === peg$FAILED) {
                        if (input.substr(peg$currPos, 2).toLowerCase() === peg$c126) {
                          s0 = input.substr(peg$currPos, 2);
                          peg$currPos += 2;
                        } else {
                          s0 = peg$FAILED;
                          if (peg$silentFails === 0) { peg$fail(peg$c325); }
                        }
                        if (s0 === peg$FAILED) {
                          if (input.substr(peg$currPos, 2).toLowerCase() === peg$c326) {
                            s0 = input.substr(peg$currPos, 2);
                            peg$currPos += 2;
                          } else {
                            s0 = peg$FAILED;
                            if (peg$silentFails === 0) { peg$fail(peg$c327); }
                          }
                          if (s0 === peg$FAILED) {
                            if (input.substr(peg$currPos, 2).toLowerCase() === peg$c328) {
                              s0 = input.substr(peg$currPos, 2);
                              peg$currPos += 2;
                            } else {
                              s0 = peg$FAILED;
                              if (peg$silentFails === 0) { peg$fail(peg$c329); }
                            }
                            if (s0 === peg$FAILED) {
                              if (input.substr(peg$currPos, 2).toLowerCase() === peg$c230) {
                                s0 = input.substr(peg$currPos, 2);
                                peg$currPos += 2;
                              } else {
                                s0 = peg$FAILED;
                                if (peg$silentFails === 0) { peg$fail(peg$c231); }
                              }
                              if (s0 === peg$FAILED) {
                                if (input.substr(peg$currPos, 2).toLowerCase() === peg$c232) {
                                  s0 = input.substr(peg$currPos, 2);
                                  peg$currPos += 2;
                                } else {
                                  s0 = peg$FAILED;
                                  if (peg$silentFails === 0) { peg$fail(peg$c233); }
                                }
                                if (s0 === peg$FAILED) {
                                  if (input.substr(peg$currPos, 2).toLowerCase() === peg$c228) {
                                    s0 = input.substr(peg$currPos, 2);
                                    peg$currPos += 2;
                                  } else {
                                    s0 = peg$FAILED;
                                    if (peg$silentFails === 0) { peg$fail(peg$c229); }
                                  }
                                }
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }

    return s0;
  }

  function peg$parsekw1() {
    var s0;

    if (input.substr(peg$currPos, 1).toLowerCase() === peg$c242) {
      s0 = input.charAt(peg$currPos);
      peg$currPos++;
    } else {
      s0 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c243); }
    }

    return s0;
  }

  function peg$parsekeyword() {
    var s0, s1, s2, s3;

    s0 = peg$currPos;
    s1 = peg$parsekw10();
    if (s1 === peg$FAILED) {
      s1 = peg$parsekw8();
      if (s1 === peg$FAILED) {
        s1 = peg$parsekw7();
        if (s1 === peg$FAILED) {
          s1 = peg$parsekw6();
          if (s1 === peg$FAILED) {
            s1 = peg$parsekw5();
            if (s1 === peg$FAILED) {
              s1 = peg$parsekw5();
              if (s1 === peg$FAILED) {
                s1 = peg$parsekw4();
                if (s1 === peg$FAILED) {
                  s1 = peg$parsekw3();
                  if (s1 === peg$FAILED) {
                    s1 = peg$parsekw2();
                    if (s1 === peg$FAILED) {
                      s1 = peg$parsekw1();
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
    if (s1 !== peg$FAILED) {
      s2 = peg$currPos;
      peg$silentFails++;
      s3 = peg$parseletter();
      peg$silentFails--;
      if (s3 === peg$FAILED) {
        s2 = void 0;
      } else {
        peg$currPos = s2;
        s2 = peg$FAILED;
      }
      if (s2 !== peg$FAILED) {
        s1 = [s1, s2];
        s0 = s1;
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parseproper_noun() {
    var s0, s1, s2, s3, s4;

    s0 = peg$currPos;
    s1 = peg$currPos;
    peg$silentFails++;
    s2 = peg$parsekeyword();
    peg$silentFails--;
    if (s2 === peg$FAILED) {
      s1 = void 0;
    } else {
      peg$currPos = s1;
      s1 = peg$FAILED;
    }
    if (s1 !== peg$FAILED) {
      s2 = peg$parseuppercase_letter();
      if (s2 !== peg$FAILED) {
        s3 = [];
        s4 = peg$parseletter();
        while (s4 !== peg$FAILED) {
          s3.push(s4);
          s4 = peg$parseletter();
        }
        if (s3 !== peg$FAILED) {
          s1 = [s1, s2, s3];
          s0 = s1;
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parseproper_variable() {
    var s0, s1, s2, s3, s4, s5, s6, s7, s8;

    s0 = peg$currPos;
    s1 = peg$currPos;
    s2 = peg$currPos;
    s3 = peg$parseproper_noun();
    if (s3 !== peg$FAILED) {
      s4 = [];
      s5 = peg$currPos;
      if (input.charCodeAt(peg$currPos) === 32) {
        s6 = peg$c330;
        peg$currPos++;
      } else {
        s6 = peg$FAILED;
        if (peg$silentFails === 0) { peg$fail(peg$c331); }
      }
      if (s6 !== peg$FAILED) {
        s7 = peg$currPos;
        s8 = peg$parseproper_noun();
        if (s8 !== peg$FAILED) {
          s7 = input.substring(s7, peg$currPos);
        } else {
          s7 = s8;
        }
        if (s7 !== peg$FAILED) {
          s6 = [s6, s7];
          s5 = s6;
        } else {
          peg$currPos = s5;
          s5 = peg$FAILED;
        }
      } else {
        peg$currPos = s5;
        s5 = peg$FAILED;
      }
      while (s5 !== peg$FAILED) {
        s4.push(s5);
        s5 = peg$currPos;
        if (input.charCodeAt(peg$currPos) === 32) {
          s6 = peg$c330;
          peg$currPos++;
        } else {
          s6 = peg$FAILED;
          if (peg$silentFails === 0) { peg$fail(peg$c331); }
        }
        if (s6 !== peg$FAILED) {
          s7 = peg$currPos;
          s8 = peg$parseproper_noun();
          if (s8 !== peg$FAILED) {
            s7 = input.substring(s7, peg$currPos);
          } else {
            s7 = s8;
          }
          if (s7 !== peg$FAILED) {
            s6 = [s6, s7];
            s5 = s6;
          } else {
            peg$currPos = s5;
            s5 = peg$FAILED;
          }
        } else {
          peg$currPos = s5;
          s5 = peg$FAILED;
        }
      }
      if (s4 !== peg$FAILED) {
        s3 = [s3, s4];
        s2 = s3;
      } else {
        peg$currPos = s2;
        s2 = peg$FAILED;
      }
    } else {
      peg$currPos = s2;
      s2 = peg$FAILED;
    }
    if (s2 !== peg$FAILED) {
      s1 = input.substring(s1, peg$currPos);
    } else {
      s1 = s2;
    }
    if (s1 !== peg$FAILED) {
      peg$savedPos = s0;
      s1 = peg$c332(s1);
    }
    s0 = s1;

    return s0;
  }

  function peg$parsecrement() {
    var s0;

    s0 = peg$parseincrement();
    if (s0 === peg$FAILED) {
      s0 = peg$parsedecrement();
    }

    return s0;
  }

  function peg$parseincrement() {
    var s0, s1, s2, s3, s4, s5, s6, s7, s8, s9;

    s0 = peg$currPos;
    if (input.substr(peg$currPos, 5).toLowerCase() === peg$c290) {
      s1 = input.substr(peg$currPos, 5);
      peg$currPos += 5;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c291); }
    }
    if (s1 !== peg$FAILED) {
      s2 = peg$parse_();
      if (s2 !== peg$FAILED) {
        s3 = peg$parsevariable();
        if (s3 !== peg$FAILED) {
          s4 = peg$parse_();
          if (s4 !== peg$FAILED) {
            s5 = [];
            s6 = peg$currPos;
            if (input.substr(peg$currPos, 2).toLowerCase() === peg$c328) {
              s7 = input.substr(peg$currPos, 2);
              peg$currPos += 2;
            } else {
              s7 = peg$FAILED;
              if (peg$silentFails === 0) { peg$fail(peg$c329); }
            }
            if (s7 !== peg$FAILED) {
              s8 = [];
              s9 = peg$parsenoise();
              while (s9 !== peg$FAILED) {
                s8.push(s9);
                s9 = peg$parsenoise();
              }
              if (s8 !== peg$FAILED) {
                s7 = [s7, s8];
                s6 = s7;
              } else {
                peg$currPos = s6;
                s6 = peg$FAILED;
              }
            } else {
              peg$currPos = s6;
              s6 = peg$FAILED;
            }
            if (s6 !== peg$FAILED) {
              while (s6 !== peg$FAILED) {
                s5.push(s6);
                s6 = peg$currPos;
                if (input.substr(peg$currPos, 2).toLowerCase() === peg$c328) {
                  s7 = input.substr(peg$currPos, 2);
                  peg$currPos += 2;
                } else {
                  s7 = peg$FAILED;
                  if (peg$silentFails === 0) { peg$fail(peg$c329); }
                }
                if (s7 !== peg$FAILED) {
                  s8 = [];
                  s9 = peg$parsenoise();
                  while (s9 !== peg$FAILED) {
                    s8.push(s9);
                    s9 = peg$parsenoise();
                  }
                  if (s8 !== peg$FAILED) {
                    s7 = [s7, s8];
                    s6 = s7;
                  } else {
                    peg$currPos = s6;
                    s6 = peg$FAILED;
                  }
                } else {
                  peg$currPos = s6;
                  s6 = peg$FAILED;
                }
              }
            } else {
              s5 = peg$FAILED;
            }
            if (s5 !== peg$FAILED) {
              peg$savedPos = s0;
              s1 = peg$c333(s3, s5);
              s0 = s1;
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  function peg$parsedecrement() {
    var s0, s1, s2, s3, s4, s5, s6, s7, s8, s9;

    s0 = peg$currPos;
    if (input.substr(peg$currPos, 5).toLowerCase() === peg$c292) {
      s1 = input.substr(peg$currPos, 5);
      peg$currPos += 5;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) { peg$fail(peg$c293); }
    }
    if (s1 !== peg$FAILED) {
      s2 = peg$parse_();
      if (s2 !== peg$FAILED) {
        s3 = peg$parsevariable();
        if (s3 !== peg$FAILED) {
          s4 = peg$parse_();
          if (s4 !== peg$FAILED) {
            s5 = [];
            s6 = peg$currPos;
            if (input.substr(peg$currPos, 4).toLowerCase() === peg$c302) {
              s7 = input.substr(peg$currPos, 4);
              peg$currPos += 4;
            } else {
              s7 = peg$FAILED;
              if (peg$silentFails === 0) { peg$fail(peg$c303); }
            }
            if (s7 !== peg$FAILED) {
              s8 = [];
              s9 = peg$parsenoise();
              while (s9 !== peg$FAILED) {
                s8.push(s9);
                s9 = peg$parsenoise();
              }
              if (s8 !== peg$FAILED) {
                s7 = [s7, s8];
                s6 = s7;
              } else {
                peg$currPos = s6;
                s6 = peg$FAILED;
              }
            } else {
              peg$currPos = s6;
              s6 = peg$FAILED;
            }
            if (s6 !== peg$FAILED) {
              while (s6 !== peg$FAILED) {
                s5.push(s6);
                s6 = peg$currPos;
                if (input.substr(peg$currPos, 4).toLowerCase() === peg$c302) {
                  s7 = input.substr(peg$currPos, 4);
                  peg$currPos += 4;
                } else {
                  s7 = peg$FAILED;
                  if (peg$silentFails === 0) { peg$fail(peg$c303); }
                }
                if (s7 !== peg$FAILED) {
                  s8 = [];
                  s9 = peg$parsenoise();
                  while (s9 !== peg$FAILED) {
                    s8.push(s9);
                    s9 = peg$parsenoise();
                  }
                  if (s8 !== peg$FAILED) {
                    s7 = [s7, s8];
                    s6 = s7;
                  } else {
                    peg$currPos = s6;
                    s6 = peg$FAILED;
                  }
                } else {
                  peg$currPos = s6;
                  s6 = peg$FAILED;
                }
              }
            } else {
              s5 = peg$FAILED;
            }
            if (s5 !== peg$FAILED) {
              peg$savedPos = s0;
              s1 = peg$c334(s3, s5);
              s0 = s1;
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }

    return s0;
  }

  peg$result = peg$startRuleFunction();

  if (peg$result !== peg$FAILED && peg$currPos === input.length) {
    return peg$result;
  } else {
    if (peg$result !== peg$FAILED && peg$currPos < input.length) {
      peg$fail(peg$endExpectation());
    }

    throw peg$buildStructuredError(
      peg$maxFailExpected,
      peg$maxFailPos < input.length ? input.charAt(peg$maxFailPos) : null,
      peg$maxFailPos < input.length
        ? peg$computeLocation(peg$maxFailPos, peg$maxFailPos + 1)
        : peg$computeLocation(peg$maxFailPos, peg$maxFailPos)
    );
  }
}

module.exports = {
  SyntaxError: peg$SyntaxError,
  parse:       peg$parse
};

},{}]},{},[2])(2)
});
