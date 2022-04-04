Q1. 
1.Overflow / underflow cases - if I do the operation pow(2,456789) - Python is going to return a huge value but the current
  implementation we have is returning 0. The way we can handle it is by using not just i32 but also support i64 etc.

2. Not Handling numbers of type float - max(0.2,0.4) - Python will return 0.4, but the current implementation we have returns
    and error as we are not handling numbers which are of the type float. There is no float type in Typescript so we can represent 
    it as a Number()
3. Number of arguments for Min and Max - Max(1,2,3) - Python returns 3, but the current implementation we have returns 
   Error: PARSE ERROR: There are more than 2 arguments. This is because in our grammer we are limiting by 2 arguments 
   which we can change to handle n arguments.


Q2. I found TA recordings very useful and Piazza and discussion with the people I mentioned in Question 3. 
Q3. I have discussed with Subha Ramesh and Sruthi Praveen Kumar Geetha.

    