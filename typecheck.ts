import { Expr, FunDef, Literal, Program , Type, VarInit, Stmt, TypedVar, UnaryOp, BinaryOp}  from './ast';

//This Map stores the variable and Type when we declare a variable
// we use this to check if the var exists in this or when we are making
// function calls, we can check if the function is present
// vars = variable name and type of variable
// funs = function name , type of arguments, return type
type TypeEnv = {
    vars : Map<string, Type>,
    funs : Map<string, [Type[], Type]>,
    retType : Type
}

function duplicateEnv(env: TypeEnv) : TypeEnv {
    return { vars : new Map(env.vars) , funs : new Map(env.funs), retType : env.retType}
}


export function typeCheckProgram(prog:Program<null>) : Program<Type>{
    //create new env
    const env : TypeEnv = {
        vars: new Map(), funs: new Map(), retType: Type.none};

    // check inits
    const typedVarInit = typeCheckVarInit(prog.varinits, env);
    prog.varinits.forEach(init => {
        env.vars.set(init.name, init.type);

    })

    // add function defs to env
    // check function
    const funDefs : FunDef<Type>[] = [];
    prog.fundefs.forEach(funs => {
        const funDef = typeCheckFunDefs(funs, env);
        env.funs.set(funs.name , [funs.params.map(param => param.type), funs.ret]);
        funDefs.push(funDef);
    })

    // check statements

    const typedStmts = typeCheckStmts(prog.stmts, env)


    return {...prog, varinits : typedVarInit , fundefs : funDefs , stmts : typedStmts};
    
}


// Typed Checked variable initialization in Typing env
export function typeCheckVarInit(inits: VarInit<null>[], env: TypeEnv) : VarInit<Type>[]{
    const typedInits : VarInit<Type>[] = [];
    inits.forEach(init => {
        const typedInit = typeCheckLiteral(init.init)
        if (typedInit.a !== init.type)
            throw new Error("TYPED ERROR: Init Type does not match literal Type")
        env.vars.set(init.name, init.type);
        typedInits.push({...init , a : init.type, init: typedInit});
    });
    return typedInits;
}


export function typeCheckParams(params: TypedVar<null>) : TypedVar<Type> {
 
        return{ ...params, a: params.type};
        
}

export function typeCheckFunDefs( fun :  FunDef<null>, env: TypeEnv) : FunDef<Type> {
    const localEnv = duplicateEnv(env);
    // Check and add Function params to env


    const typedParams : TypedVar<Type>[] = [];
    fun.params.forEach(param =>  {
        const typedParam = typeCheckParams(param);
        localEnv.vars.set(typedParam.name, param.type);
        typedParams.push(typedParam);
    })

    // add inits to env
    // check inits

    const typedInits = typeCheckVarInit(fun.inits, env)
    fun.inits.forEach(init => {
        localEnv.vars.set(init.name, init.type)

    })
    // add function type to env
    localEnv.funs.set(fun.name , [fun.params.map(param => param.type), fun.ret])

    // add return type
    localEnv.retType = fun.ret
    // check body
    // make sure every path has the expected return type
    const typedStmts = typeCheckStmts(fun.body, localEnv)

    return {...fun, params : typedParams,  inits : typedInits, body: typedStmts };
}

export function typeCheckStmts(stmts : Stmt<null>[], env: TypeEnv) : Stmt<Type>[] {
const typedStmts : Stmt<Type>[] = [];

    stmts.forEach(stmt => {
    switch(stmt.tag) {
        case "assign":
            // a = 0
            // this check is a is present in the env
            if( !env.vars.has(stmt.name))
                throw new Error("TYPE ERROR :  unbound id")
            //    
            const typedValue = typeCheckExpr(stmt.value , env);
            if ( typedValue.a !== env.vars.get(stmt.name))
                throw new Error("TYPE ERROR : cannot assign value to id")
            typedStmts.push({...stmt, value : typedValue, a: Type.none})
            break;
        
        case "return":
            const typedRet = typeCheckExpr(stmt.expr, env);
            if( env.retType !== typedRet.a)
                throw new Error("TYPE ERROR: return type not matching")
            typedStmts.push({...stmt });

            break;
        
        case "ifelse": {
            const ifcond = typeCheckExpr(stmt.ifcond, env);
            if(ifcond.a != Type.bool) {
                throw new TypeError("Expect type BOOL in condition")
            }
            const ifBody = typeCheckStmts(stmt.ifbody, env);

            var elifcond
            var elifBody

            if(stmt.elif != null) {
                elifcond = typeCheckExpr(stmt.elif, env);
                if(elifcond.a != Type.bool) {
                    throw new TypeError("Expect type BOOL in condition")
                }
                if (stmt.elifbody ) elifBody = typeCheckStmts(stmt.elifbody, env);

            }
            
            
            const elseBody = typeCheckStmts(stmt.elsebody, env);
            console.log("ifcond", ifcond)
            console.log("ifbody", ifBody)
            console.log("elifcond", elifcond)
            console.log("elifbody", elifBody)
            console.log("elsebody", elseBody)


            typedStmts.push({...stmt, ifcond : ifcond, ifbody: ifBody,elif: elifcond, elifbody: elifBody, elsebody: elseBody});
        }
        break;
       case "while": {
            const ifcond = typeCheckExpr(stmt.cond, env);
            if(ifcond.a != Type.bool) {
                throw new TypeError("Expect type BOOL in condition")
            }

            const newBody = typeCheckStmts(stmt.body,env);

            typedStmts.push({ ...stmt, cond: ifcond, body: newBody});

        }
        break;
        case "pass":
            typedStmts.push({...stmt, a:Type.none});
            break;
        case "expr":
            const typedExpr = typeCheckExpr(stmt.expr, env);
            typedStmts.push({...stmt, expr: typedExpr, a: Type.none});
            break;
         default:
            throw new Error("TYPE ERROR : Statement not handled")
    }
})
    return typedStmts;
}


export function typeCheckExpr(expr: Expr<null>, env: TypeEnv) : Expr<Type> {
    switch(expr.tag){
        case "id":
            if(!env.vars.has(expr.name))
                throw new Error("TYPE CHECK: unbound id")
            const idType = env.vars.get(expr.name);
            return { ...expr, a: idType}
        
        case "builtin1":
            const arg = typeCheckExpr(expr.arg, env);
            return{ ...expr, arg : arg, a: Type.int}
           
        case "builtin2":
            const arg1 = typeCheckExpr(expr.arg1, env);
            const arg2 = typeCheckExpr(expr.arg2, env);
            if(arg1.a !== Type.int)
                throw new Error("TYPE ERROR: arg1 must be int");
             if(arg2.a !== Type.int)
                 throw new Error("TYPE ERROR: arg2 must be int");
            return{ ...expr, arg1 : arg1, arg2 : arg2, a: Type.int};
        case "unaryexp":
            const argUni = typeCheckExpr(expr.left, env);
            switch(expr.op){
                case "not": 
                    if(argUni.a !== Type.bool)
                        throw new Error("TYPE ERROR : Unary : Argument Not Bool ")
                    return { ...expr , a : Type.bool}
                case "-":
                    if(argUni.a != Type.int)
                        throw new Error("TYPE ERROR : Unary : Argument Not Int ")
                    return { ...expr , a : Type.int}
                default:
                    throw new Error("TYPE ERROR : Unary not supported")
            }
        case "binaryexp":
            const left = typeCheckExpr(expr.left, env);
            const right = typeCheckExpr(expr.right, env);
            switch(expr.op){
                case "+":
                case "-":
                case "*":
                case "//":
                case "%":
                    if(left.a != Type.int && right.a != Type.int)
                        throw new Error("TYPE ERROR : Binary : Argument Not Int ")
                    return {...expr, a : Type.int}
                case "<":
                case ">":
                case "<=":
                case ">=":
                    if(left.a != Type.int && right.a != Type.int)
                        throw new Error("TYPE ERROR : Binary : Argument Not Int ")
                return {...expr, a : Type.bool}
                case "==":
                case "!=":
                    if((left.a != Type.int && right.a != Type.int) || (left.a != Type.bool && right.a != Type.bool) )
                        throw new Error("TYPE ERROR : Binary : Argument Not Right ")
                    return {...expr, a : Type.bool}
                    
                default:
                    throw new Error("TYPE ERROR : Binary not supported")
            }

        
        case "call":
           // Checking function name 
           if(!(env.funs.has(expr.name)))
                throw new Error("TYPE ERROR : Incorrect Function name");
            // Checking number of arguments
            const [args, type] = env.funs.get(expr.name);
            if(args.length !== expr.args.length)
                throw new Error("TYPE ERROR : Number of arguments incorrect ");

            
            //Type of arguments
            return {...expr};

        case "literal":
            const lit = typeCheckLiteral(expr.literal)
            return { ...expr, a: lit.a}
        default:
            throw new Error("TYPE ERROR : This type of expression not handled")
    }

}
export function typeCheckLiteral(literal : Literal<null>) : Literal<Type> {
    switch(literal.tag){
        case "num":
            return { ...literal, a : Type.int};
        case "bool":
            return { ...literal, a: Type.bool};
        case "none":
            return { ...literal, a: Type.none};
    }

}