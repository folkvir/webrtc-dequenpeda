1. description
there is one table "triple_person" that contains every information

2. how to use data.
you may create a database and put the data in it. 

1. create a table "triple_person"

CREATE TABLE `triple_person` (
  `subject` varchar(250) NOT NULL default '',
  `predicate` varchar(250) NOT NULL default '',
  `object` varchar(250) NOT NULL default '',
  `anno_subject` tinyint(1) NOT NULL default '0',
  `literal_object` tinyint(1) NOT NULL default '0',
  `anno_object` tinyint(1) default NULL,
  `url` varchar(250) default NULL,
  KEY `url` (`url`)
);


2. load data into database using JDBC
NOTE:  since there could be line breaks in Literals, we need to check if a line starts with "INSERT INTO" to 
            avoid invalid insert SQL query.

Below is a simple script written in JAVA. By the end you will get 201,612 entries in the table.

		String line="";
		String insert ="";
		try {
			//TODO: create your database connection
			Statement stmt = ...

			//open the sql insertion file
			BufferedReader in  = new BufferedReader(new java.io.FileReader("triple_person.sql"));
			
			//insert triples
			while(null!=(line=in.readLine())){
				if (line.startsWith("INSERT INTO triple_person")){
					if (insert.length()>0)
						stmt.execute(insert);
					insert = line;
				}else
					insert +="\n"+line;
			}
			dbw.operateWrite(insert);

			in.close();
		}catch (SQLException e){
			e.printStackTrace();
		}catch (IOException e){
			e.printStackTrace();
		}

3. for any futher information, contact me at dingli1@umbc.edu.

date: 4:11 PM 2/23/2005
author:  Li Ding
affiliation:  ebiquity research group, CSEE, UMBC.   http://ebiquity.umbc.edu/